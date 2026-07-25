import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { buildArtifacts, tailorResume } from "./pipeline.js";
import { getDemo } from "./demo/cache.js";
import { validateInput, ValidationError } from "./security/validate.js";
import { isServiceUnavailableError } from "./engine/claude.js";
import { closeBreaker, isBreakerOpen, tripBreaker } from "./breaker.js";
import { dailyBudget, demoLimiter, paidLimiter } from "./security/rateLimit.js";
import { artifactHandler } from "./artifacts/store.js";
import { createPaymentLayer } from "./payment/x402.js";

const PORT = Number(process.env.PORT ?? 8792);
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";
const PRICE = process.env.PRICE ?? "0.03";
const WEB_DIST = path.resolve("web/dist");
const HAS_SITE = existsSync(path.join(WEB_DIST, "index.html"));

// Paid A2MCP endpoint (both verbs — OKX x402-check and buyers probe GET).
const PAID_PATHS = new Set(["/x402/tailor"]);
const ROUTE_KEYS = ["POST /x402/tailor", "GET /x402/tailor"];

/* ─────────────────────────────── core handler ──────────────────────────── */

async function handleTailor(req: Request, res: Response, fast: boolean): Promise<void> {
  try {
    const raw = req.method === "POST" && req.body && Object.keys(req.body).length ? req.body : req.query;
    const input = validateInput(raw);
    const result = await tailorResume(input, { fast });
    closeBreaker();
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (isServiceUnavailableError(err)) {
      tripBreaker();
      res.status(503).set("Retry-After", "120").json({
        error: "Service temporarily unavailable. No result was produced. Please retry shortly.",
      });
      return;
    }
    console.error("[tailor] error:", (err as Error)?.message);
    res.status(500).json({ error: "Failed to tailor the resume. Please try again." });
  }
}

/* ──────────────────────────────── boot ─────────────────────────────────── */

async function main(): Promise<void> {
  const app = express();
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // Request timing — log the work paths so latency regressions are visible (the app was
  // previously silent, which made the paid-endpoint timeout hard to diagnose).
  const LOGGED = /^\/(x402\/tailor|try)$/;
  app.use((req, res, next) => {
    if (!LOGGED.test(req.path)) return next();
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const cache = res.getHeader("X-Demo-Cache") ? " cache=hit" : "";
      console.log(`[req] ${req.method} ${req.path} ${res.statusCode} ${ms}ms${cache}`);
    });
    next();
  });

  app.use(express.json({ limit: "14mb" }));

  if (HAS_SITE) app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));

  // Breaker gate BEFORE payment — never charge for a request we can't serve.
  app.use((req, res, next) => {
    if (PAID_PATHS.has(req.path) && isBreakerOpen()) {
      res.status(503).set("Retry-After", "120").json({
        error: "Service temporarily unavailable. No payment was taken. Please retry shortly.",
      });
      return;
    }
    next();
  });

  // Payment middleware must sit ahead of the paid routes (hence async assembly here).
  if (PAYMENTS_ENABLED) {
    const paymentLayer = await createPaymentLayer(ROUTE_KEYS);
    app.use((req, res, next) =>
      PAID_PATHS.has(req.path) ? paymentLayer.middleware(req, res, next) : next(),
    );
    // Initialize the facilitator after we know the layer built; guarded.
    void paymentLayer
      .initialize()
      .then(() => console.log("[payments] facilitator initialized"))
      .catch((e) => console.error("[payments] initialize failed:", (e as Error)?.message));
  }

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/artifacts/:id", artifactHandler);

  // $0 cache for the fixed website examples — replay before spending a Claude call.
  async function demoCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const b = req.body as { resume?: string; jobDescription?: string; resumeFile?: unknown };
      if (b && typeof b.resume === "string" && typeof b.jobDescription === "string" && !b.resumeFile) {
        const hit = getDemo(b.resume, b.jobDescription);
        if (hit) {
          const artifacts = await buildArtifacts(hit);
          res.setHeader("X-Demo-Cache", "hit");
          res.json({ ...hit, evidence: hit.evidence ?? [], artifacts });
          return;
        }
      }
    } catch {
      /* fall through to a live run */
    }
    next();
  }

  // Free website demo path — quality tier (a human is waiting, latency is fine).
  app.post("/try", demoCache, demoLimiter, dailyBudget, (req, res) => handleTailor(req, res, false));

  // Paid A2MCP endpoint — fast tier so the response beats the buyer's HTTP read timeout.
  app.post("/x402/tailor", paidLimiter, (req, res) => handleTailor(req, res, true));
  app.get("/x402/tailor", paidLimiter, (req, res) => handleTailor(req, res, true));

  // Content negotiation: site for browsers, machine manifest for agents.
  app.get("/", (req, res) => {
    if (HAS_SITE && (req.headers.accept ?? "").includes("text/html")) {
      res.sendFile(path.join(WEB_DIST, "index.html"));
      return;
    }
    res.json({
      name: "Resumurai",
      tagline: "Slice your resume to cut through the ATS.",
      service:
        "Paste a resume + a target job description → ATS score (before/after), gap analysis, and a real ATS-safe .docx/.pdf resume + cover letter.",
      endpoint: "POST /x402/tailor",
      price: `${PRICE} USDT per call`,
      network: "X Layer (eip155:196)",
      payments: PAYMENTS_ENABLED ? "x402 (A2MCP)" : "open (dev mode)",
      input: { resume: "string (or resumeFile {kind,base64,mediaType})", jobDescription: "string (or jobUrl)" },
    });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] error:", err?.message);
    res.status(500).json({ error: "Internal error." });
  });

  const server = app.listen(PORT, () =>
    console.log(`Resumurai listening on :${PORT}  payments=${PAYMENTS_ENABLED}  site=${HAS_SITE}`),
  );

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("unhandledRejection", (r) => console.error("[unhandledRejection]", r));
}

void main();
