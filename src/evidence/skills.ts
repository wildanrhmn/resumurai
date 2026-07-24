import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Evidence, ResumeModel } from "../engine/schema.js";
import { resumeToText } from "../engine/normalize.js";

/**
 * Ground the role's real technology skills in O*NET — the US Dept of Labor's occupational
 * standard. Two paths:
 *   1. BUNDLED (default, no key): the public-domain O*NET database is processed into
 *      src/evidence/onet-data.json (scripts/build-onet.mjs) — instant, offline, no limits.
 *   2. API FALLBACK (optional ONET_API_KEY): only when the local title index has no match.
 *      O*NET's live keyword search is more forgiving for unusual titles.
 * ESCO was evaluated and rejected: its abstract EU competences don't cover modern tools
 * ("Kubernetes"/"Docker" aren't in it) and it mis-mapped common roles.
 * Attribution ("Skills data: O*NET") is shown in the site footer.
 */
interface Bundle {
  version: string;
  tools: Record<string, string[]>;
  titles: Record<string, string>; // normalized title -> SOC
  occ: Record<string, string>; // SOC -> display title
}
interface Match {
  title: string;
  tools: string[];
}

let data: Bundle | null = null;
function load(): Bundle {
  if (data) return data;
  const p = ["src/evidence/onet-data.json", "dist/evidence/onet-data.json"].map((x) => path.resolve(x)).find(existsSync);
  try {
    data = p ? (JSON.parse(readFileSync(p, "utf8")) as Bundle) : { version: "", tools: {}, titles: {}, occ: {} };
  } catch {
    data = { version: "", tools: {}, titles: {}, occ: {} };
  }
  return data;
}

/** MUST match scripts/build-onet.mjs normTitle exactly. */
function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/back[\s-]?end/g, "backend")
    .replace(/front[\s-]?end/g, "frontend")
    .replace(/full[\s-]?stack/g, "fullstack")
    .replace(/\b(developer|programmer|dev|engineer)s?\b/g, "eng")
    .replace(/\b(senior|junior|lead|staff|principal|entry|mid|sr|jr|associate|intern|trainee)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Query-side only: drop trailing qualifiers ("…, Fintech Payments" / "… - Remote"). */
function cleanRole(role: string): string {
  return role.replace(/,.*$/, "").replace(/[-–—].*$/, "").trim();
}

// Vendor/generic words that carry no signal in an O*NET technology name.
const VENDOR = new Set([
  "software", "system", "systems", "amazon", "web", "services", "service", "microsoft", "apache",
  "adobe", "google", "oracle", "ibm", "cloud", "platform", "tool", "tools", "application",
  "program", "programs", "suite", "server", "database", "language", "development", "environment",
  "framework", "library", "the", "and", "for", "based", "management", "user", "interface", "query",
]);

/** Distinctive tokens for an O*NET tool name (acronyms + specific product words). */
function toolTokens(tool: string): string[] {
  const acronyms = (tool.match(/\b[A-Z]{2,6}\b/g) ?? []).map((a) => a.toLowerCase());
  const words = tool
    .toLowerCase()
    .replace(/[^a-z0-9+# ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !VENDOR.has(w));
  return [...new Set([...acronyms, ...words])];
}

/* ───────────────────────────── path 1: bundled ──────────────────────────── */

function findSoc(role: string): { soc: string; exact: boolean } | null {
  const d = load();
  const q = normTitle(cleanRole(role));
  if (!q) return null;
  if (d.titles[q]) return { soc: d.titles[q], exact: true };
  const qt = q.split(" ").filter(Boolean);
  if (qt.length === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const [t, soc] of Object.entries(d.titles)) {
    const tt = new Set(t.split(" "));
    const score = qt.filter((w) => tt.has(w)).length / qt.length;
    if (score > bestScore) {
      bestScore = score;
      best = soc;
    }
  }
  return bestScore >= 0.6 && best ? { soc: best, exact: false } : null;
}

function fromBundle(role: string): { match: Match; exact: boolean } | null {
  const d = load();
  const hit = findSoc(role);
  if (!hit) return null;
  const tools = (d.tools[hit.soc] ?? []).slice(0, 25);
  return tools.length >= 3 ? { match: { title: d.occ[hit.soc] ?? role, tools }, exact: hit.exact } : null;
}

/* ──────────────────── path 2: live API fallback (optional) ──────────────── */

const ONET = "https://api-v2.onetcenter.org";
const apiKey = () => process.env.ONET_API_KEY ?? "";

async function oget(pathname: string, timeoutMs = 6000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${ONET}${pathname}`, {
      headers: { "X-API-Key": apiKey(), Accept: "application/json" },
      signal: ctrl.signal,
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Tools live at category[].example[].title (the summary endpoint is paginated). */
function extractTools(payload: any): string[] {
  const out = new Set<string>();
  for (const cat of payload?.category ?? []) {
    for (const ex of cat?.example ?? []) {
      const name = typeof ex === "string" ? ex : (ex?.title ?? ex?.name);
      if (name) out.add(String(name));
    }
  }
  return [...out];
}

async function fromApi(role: string): Promise<Match | null> {
  if (!apiKey()) return null;
  const search = await oget(`/online/search?keyword=${encodeURIComponent(cleanRole(role))}&start=1&end=3`);
  const occ = search?.occupation?.[0];
  if (!occ?.code) return null;
  const tech = await oget(`/online/occupations/${occ.code}/summary/technology_skills?start=1&end=20`);
  const tools = extractTools(tech).slice(0, 25);
  return tools.length >= 3 ? { title: String(occ.title ?? role), tools } : null;
}

/* ──────────────────────────────── evidence ─────────────────────────────── */

export async function skillsEvidence(role: string, resume: ResumeModel): Promise<Evidence[]> {
  if (!role.trim()) return [];

  // Exact local hit wins (instant, offline). Otherwise prefer the live API — its keyword
  // search resolves unusual titles far better than our fuzzy index — and only fall back to
  // the fuzzy local match if the API is unavailable or has no key.
  const local = fromBundle(role);
  const match = local?.exact ? local.match : ((await fromApi(role)) ?? local?.match ?? null);
  if (!match) return [];

  const resumeTokens = new Set(resumeToText(resume).split(" ").filter(Boolean));
  const covered = match.tools.filter((tool) => toolTokens(tool).some((tok) => resumeTokens.has(tok)));
  const ratio = covered.length / match.tools.length;

  return [
    {
      label: "Role validated against O*NET",
      detail: `O*NET (US Dept of Labor) classifies this role as “${match.title}”; your résumé covers ${covered.length} of its ${match.tools.length} key technologies.`,
      source: "O*NET",
      status: ratio >= 0.3 ? "pass" : "info",
    },
  ];
}
