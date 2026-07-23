# Resumurai 🗡️ — ATS Resume Tailoring ASP · Build Plan

> Second OKX.AI ASP (after Scaminja / agent 5318). Clean repo, best-practice architecture,
> non-crypto, consumer, A2MCP pay-per-call. Category: **Resume & Career Workflows** (X Layer
> solicited it by name) + **Professional Asset Creation** (real downloadable files).
> Deadline: **2026-07-27 23:59 UTC** (winners 08-03). Don't cap the idea by remaining time.
>
> **DECISIONS LOCKED (2026-07-23):**
> - **Name: Resumurai** (résumé + samurai). Gimmick: a samurai who *slices your résumé sharp* to cut
>   through the ATS. Sibling to Scaminja (ninja) — same "dojo" studio family. Verdict flavor:
>   "blade sharpened · ATS 42 → 89".
> - **Price: 0.03 USDT/call.** Cover letter **ON by default** (résumé + cover letter + memo per call).
> - **Domain:** user supplies at P5 (deploy). Build proceeds P0–P4 without it.
> - Same VPS + same Agentic Wallet / OKX account as Scaminja; new port **:8792**.

---

## 1. Why this product (the thesis)

- **The category is empty.** On okx.ai the entire Resume & Career lane is *Resume Curator* (5 sold),
  *Vouch* (2), *Placd* (2). No leader, no traction, no moat to fight. X Layer explicitly asked for
  *"agents that generate, optimize, and benchmark resumes for specific roles, industries, and hiring
  systems… ATS-ready outputs, stronger positioning."*
- **The proven winning pattern is "one prompt → a real, downloadable, polished artifact."** PixelBrief
  (one prompt → a bundle of real brand assets) is the #1 seller platform-wide at 10,110 sold — 5.5× #2.
  Everyone else returns text/JSON. **Returning a real `.docx`/`.pdf` is the wow nobody in this lane ships.**
- **Repeatable + viral.** Every job application is a fresh call (high LTV per user). The before/after
  ATS score (42 → 89) is an inherently shareable demo → targets the **Social Buzz** track (10 winners).

### The real differentiator (our moat vs. "ChatGPT, rewrite my resume")
Two things generic AI resume tools get wrong, that we do right:
1. **A real, explainable ATS score** — a deterministic, transparent methodology, not vibes. The user sees
   *exactly* which keywords/requirements they're missing and why the score moved.
2. **ATS-*safe* file output** — most AI tools emit pretty resumes with multi-column layouts, tables,
   text-boxes, icons, and headers/footers that **break real ATS parsers**. Our deterministic renderer
   *guarantees* a single-column, standard-heading, parser-friendly `.docx` — the format that actually
   passes. This is a genuine, hard, valuable problem and the core of our credibility.
3. **Truthful tailoring guardrail** — we only reframe/surface *existing* experience and inject keywords
   the user can *honestly* claim; keywords we can't truthfully add are reported as "gaps to address,"
   never fabricated. Ethical **and** a quality signal (fabricated resumes get people rejected/fired).

---

## 2. What the user gets (per call)

Input: **their resume** (pasted text, or a `.pdf`/`.docx` upload) + **a target job description**
(pasted text, or optionally a job-posting URL to fetch).

Output (one response):
- **ATS Match: `before → after`** with a transparent breakdown (keyword coverage, hard requirements,
  formatting/parseability, completeness).
- **Gap analysis** — missing keywords, unmet hard requirements (e.g. "5+ yrs required, resume shows 3"),
  which keywords we *did* truthfully inject, and honest gaps to work on.
- **A rewritten, role-tailored, ATS-safe résumé** → `tailored-resume.docx` + `tailored-resume.pdf`.
- **A tailored cover letter** → `cover-letter.docx` (optional flag, on by default).
- **A positioning memo** — why you clear the filter, what to emphasize in the interview.

---

## 3. Architecture (best practice)

### 3.1 The core pattern: **plan → render** (two stages)
Never ask the model for file bytes or trust it with layout. The LLM decides *content & structure*;
deterministic code guarantees *a valid, ATS-safe, downloadable artifact every time*.

```
                 ┌────────────────── ANALYZE (LLM + deterministic) ───────────────────┐
 resume + JD ──▶ │  1. normalize inputs (parse file→text if needed)                    │
                 │  2. LLM structured-extract JD → {mustHave[], niceToHave[],          │
                 │     hardRequirements[], seniority, role, industry}                   │
                 │  3. deterministic ATS score (before) over the ORIGINAL resume        │
                 │  4. LLM produce TAILORING SPEC (zod): rewritten summary, reordered   │
                 │     + rewritten bullets w/ truthful keyword injection, skills, etc.  │
                 │  5. deterministic ATS score (after) over the tailored spec           │
                 └────────────────────────────────┬───────────────────────────────────┘
                                                  ▼
                 ┌────────────────────────── RENDER (deterministic) ───────────────────┐
     spec  ────▶ │  docx lib   → ATS-safe .docx (single col, std headings, no tables)   │
                 │  pdfkit/@react-pdf → styled .pdf from the SAME spec                   │
                 │  docx lib   → cover-letter.docx                                       │
                 └────────────────────────────────┬───────────────────────────────────┘
                                                  ▼
                        JSON { ats, gaps, memo, artifacts:[{id,filename,mime,base64,url}] }
```

**Why deterministic render (not LLM-emitted files):** reliable, unit-testable, cheap, and the reason the
output looks professional and *parses* instead of looking LLM-ish. The ATS-safety rules live in code, not
in a prompt the model might ignore.

### 3.2 The ATS scoring methodology (the credibility core — explainable, not a black box)
Weighted, deterministic, and shown to the user:
- **Keyword coverage — 40%.** LLM extracts must-have + nice-to-have keywords/skills from the JD; we
  normalize (lowercase, stem, synonym map, e.g. "k8s"↔"kubernetes") and compute % present in the resume.
- **Hard requirements — 25%.** Parse years-of-experience, degree, certifications, specific tools from the
  JD; check each against the resume; report met/unmet explicitly.
- **Formatting / parseability — 20%.** Single column, standard section headings, no tables/images/
  text-boxes, standard fonts, contact info present, dates parseable, safe file type. (Assessed on the
  input; *guaranteed* on the output by the renderer, which is why "after" scores high here.)
- **Completeness — 15%.** Summary present, quantified achievements, relevant sections, reasonable length.

Score = weighted sum, 0–100. "After" is recomputed on the tailored spec. Every sub-score ships with a
one-line reason, so the number is defensible and the demo is trustworthy.

### 3.3 File rendering choices (VPS-friendly, no headless browser)
The VPS has ~1.9 GB RAM, so we avoid Chromium/LibreOffice.
- **`.docx`** via the `docx` npm library — full programmatic control, trivially ATS-safe.
- **`.pdf`** via `pdfkit` (or `@react-pdf/renderer`) from the *same* structured spec — deterministic,
  dependency-light, no browser. Two renderers, one spec → the `.docx` and `.pdf` never diverge.
- **Input file parsing:** `.docx` → `mammoth` (→ text); `.pdf` → `pdf-parse` (fast) with a Claude
  document-block fallback for scanned/image PDFs (same trick Scaminja uses). Text input is the primary
  path; file upload is the enhancement.

### 3.4 Delivery
Artifacts returned two ways so **both humans and agents** can consume them:
- Inline `base64` in the JSON (agents/A2MCP callers get the bytes directly, no second hop).
- A short-lived download URL `GET /artifacts/:id` (TTL ~30 min, in-memory or disk with sweep) for the
  website's download buttons.

### 3.5 What we deliberately carry over from Scaminja (patterns, re-authored — NOT a fork)
These are genuinely best-practice for an OKX A2MCP and were hard-won against the live facilitator:
- **x402 gating via the official OKX Payment SDK** (`@okxweb3/x402-core|evm|express`), USDT0 on X Layer
  (`eip155:196`), atomic price, EIP-712 domain in `accepts.extra`, `initialize()` after `listen()`.
- **Circuit breaker before the payment gate** — never charge a buyer when the engine can't serve.
- **Split rate limiting** — lenient `paidLimiter` for x402 paths, tight `demoLimiter` + daily budget
  kill-switch for the free website (protects our Claude balance).
- **Content-negotiated `/`** — HTML site to browsers, JSON manifest to agents/curl.
- **React 19 + Vite-SSG** editorial marketing/demo site + **demo-cache** (fixed examples cost $0).

### 3.6 What's genuinely new (designed fresh here)
- The **plan→render artifact pipeline** (Scaminja returns verdicts, never files).
- The **ATS scoring engine** (deterministic + explainable).
- The **artifact storage/delivery** layer (`/artifacts/:id`, TTL, base64).
- Resume/JD **input parsing** (docx/pdf → text).

---

## 4. Repository layout (clean, best-practice)

```
applied/
  package.json                # backend: express, anthropic, docx, pdfkit, okx x402, zod
  tsconfig.json               # ESM, strict
  .env.example                # canonical config knobs (documented)
  README.md                   # with mermaid diagrams
  BUILD-PLAN.md               # this file
  src/
    index.ts                  # express entry: routes, static, negotiation, breaker, limiters, x402
    breaker.ts                # circuit breaker
    types.ts                  # input contract (TailorInput, Attachment)
    engine/
      schema.ts               # zod: JDSpec, TailoringSpec, AtsScore, TailorResult (output contract)
      extract-jd.ts           # LLM structured extraction of the job description
      score.ts                # deterministic ATS scoring (before/after) + explanations
      tailor.ts               # LLM produces the tailoring spec (truthful reframing)
      normalize.ts            # keyword normalization / synonym map / stemming
      dispatch.ts             # orchestrates analyze→score→tailor→score, shared by server + cache-gen
    render/
      resume-docx.ts          # spec → ATS-safe .docx (docx lib)
      resume-pdf.ts           # spec → styled .pdf (pdfkit) from the same spec
      cover-letter.ts         # spec → cover-letter.docx
      ats-rules.ts            # the hard-coded ATS-safe formatting constraints (shared)
    parse/
      resume-file.ts          # .docx (mammoth) / .pdf (pdf-parse + Claude fallback) → text
    artifacts/
      store.ts                # in-memory/disk artifact store w/ TTL + GET /artifacts/:id handler
    payment/
      config.ts               # payment env → typed config; USDT0/X-Layer constants (re-authored)
      x402.ts                 # OKX Payment SDK wiring + gating middleware (re-authored)
    security/
      rateLimit.ts            # paid + demo limiters, daily budget
      validate.ts             # input validation + size caps
    demo/
      demo-cache.json         # pre-computed results for the fixed website examples
  scripts/
    gen-demo-cache.ts         # regenerate demo-cache.json via the real engine
    demo-x402.mjs             # buyer-agent reference client (402 → pay → replay)
  web/                        # React 19 + Vite SSG (separate npm project)
    index.html                # SEO <head> template
    vite.config.ts            # dev proxy → live API
    src/
      main.tsx                # ViteReactSSG(<App/>)
      App.tsx                 # landing page (hero, how-it-works, try, agent-economy, footer)
      components/
        TryConsole.tsx        # paste resume + JD → animated before/after score + downloads
        Background.tsx
      index.css
    public/                   # brand PNGs, /demo/*, robots.txt, sitemap.xml
  test/
    score.test.ts             # ATS scoring unit tests (deterministic → easy to test)
    render.test.ts            # .docx/.pdf render smoke (valid file, ATS-safe structure)
```

---

## 5. API contract

### Paid A2MCP endpoint (the listed service)
`POST /x402/tailor` (and `GET` for OKX's x402-check probe) — x402-gated, **~0.03 USDT/call**.

Request:
```jsonc
{
  "resume": "…plain text…",                 // or:
  "resumeFile": { "kind": "pdf|docx", "base64": "…" },
  "jobDescription": "…plain text…",          // or:
  "jobUrl": "https://…",                     // optional: fetch + parse a posting
  "options": { "includeCoverLetter": true, "tone": "professional", "targetRole": "…" }
}
```

Response (zod-validated):
```jsonc
{
  "role": "Senior Backend Engineer", "company": "…",
  "ats": {
    "scoreBefore": 42, "scoreAfter": 89,
    "breakdown": {
      "keywordCoverage":  { "before": 35, "after": 92, "reason": "…" },
      "hardRequirements": { "before": 50, "after": 80, "reason": "…" },
      "formatting":       { "before": 40, "after": 100, "reason": "single-column, standard headings" },
      "completeness":     { "before": 55, "after": 90, "reason": "…" }
    }
  },
  "gaps": {
    "missingKeywords": ["Kubernetes", "SOC2", "gRPC"],
    "unmetHardRequirements": ["5+ yrs required; resume shows 3"],
    "injectedKeywords": ["CI/CD", "PostgreSQL", "OKR"],     // truthfully added
    "notAddressable": ["SOC2 — no evidence in your history"] // honest gaps
  },
  "tailoredResume": { /* structured spec */ },
  "coverLetter": "…",
  "positioningMemo": "…",
  "artifacts": [
    { "id": "…", "filename": "tailored-resume.docx", "mimeType": "application/vnd…", "base64": "…", "url": "/artifacts/…" },
    { "id": "…", "filename": "tailored-resume.pdf",  "mimeType": "application/pdf",  "base64": "…", "url": "/artifacts/…" },
    { "id": "…", "filename": "cover-letter.docx",    "mimeType": "application/vnd…", "base64": "…", "url": "/artifacts/…" }
  ],
  "disclaimer": "Tailoring reframes your real experience; it never fabricates. Verify all claims."
}
```

### Other routes
- `POST /try` — free website path (rate-limited + daily budget + demo-cache).
- `GET /artifacts/:id` — serves a generated file (short TTL).
- `GET /health` → `{ ok: true }`.
- `GET /` — content-negotiated: HTML site to browsers, JSON service manifest to agents.

---

## 6. Naming & brand

The concept card said "Applied," but that's a generic word (weak for SEO/brand). Shortlist to decide
(matches your editorial taste from Scaminja):
- **ClearFilter** — "clear the ATS filter." Descriptive, confident. *(my pick)*
- **PassLine** — pass the screening line.
- **ATSmith** — ATS + -smith (pairs with the "GridSmith" family if you ever build more).
- **Landed** — you landed the interview.
- **Tailr** — tailor, short & brandable.
- **Applied** — keep the concept name (simple, but generic).

Brand direction: reuse the Scaminja editorial system (big uppercase Space Grotesk, mono label-caps,
dark/light ABAB sections, solid accent button) but a **new palette** (Scaminja is cyan/ninja; this one
wants a "career/confidence" palette — e.g. deep indigo + warm gold, or clean green "pass"). New square
avatar for the OKX listing (1:1, <1 MB).

---

## 7. Prize-track fit
- **Best Product** — completeness: real files + explainable scoring + truthful guardrail.
- **Lifestyle Companion** ($7.5k) — resume tools list under Lifestyle on okx.ai; near-empty category.
- **Revenue Rocket** ($20k) — most repeatable purchase on the platform (every application).
- **Social Buzz** ($10k, 10 winners) — before/after score is a natural shareable demo.
- **Professional Asset Creation** theme — real executive-ready file output.

---

## 8. Deployment (reuse the Scaminja playbook)
- Same VPS `43.134.116.188` (currently runs only Scaminja on :8791). New pm2 process on **:8792**.
- New domain (user to choose/point — e.g. `clearfilter.app`), nginx site + Let's Encrypt, `/artifacts/`
  proxied with a sane `client_max_body_size`.
- `.env`: `ANTHROPIC_API_KEY`, `MODEL=claude-sonnet-5`, `PRICE=0.03`, `PORT=8792`,
  `PAYMENTS_ENABLED`, `PAY_TO_ADDRESS` (same Agentic Wallet `0x4eb6…993a`), OKX API triple.
- OKX registration: `agent upload` (avatar) → `agent create --role asp` (ONE A2MCP service, endpoint
  `https://<domain>/x402/tailor`) → `agent activate` → ~review. Same account (agent 5318 owner).

---

## 9. Milestones
- **P0 — Scaffold.** Clean repo, tsconfig/ESM, package.json, shared zod schema, `.env.example`.
- **P1 — Engine (offline-testable).** JD extraction → deterministic ATS score → tailoring spec → after
  score. Unit tests on scoring. No payment, no web yet — provable via `npm run` on fixtures.
- **P2 — Renderers + delivery.** ATS-safe `.docx`, styled `.pdf`, cover letter, artifact store + route.
- **P3 — Payment + server.** x402 layer, endpoints, breaker, rate limiting, manifest, health.
- **P4 — Website.** React SSG editorial site + Try console (animated before/after + downloads) + demo-cache.
- **P5 — Deploy.** VPS :8792 + domain + certbot + payments ON + `agent x402-check` valid.
- **P6 — Register.** avatar + `agent create` + `activate` → OKX review.
- **P7 — Submit.** ≤90s #okxai X demo post + Google form before 07-27 23:59 UTC.

---

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| PDF fidelity without a browser | `pdfkit`/`@react-pdf` from the structured spec — controlled, low-RAM, no Chromium. |
| Hallucinated/fabricated experience | Structural + prompt guardrail: reframe only; report non-addressable keywords as honest gaps. |
| "Is the ATS score real?" skepticism | Transparent weighted methodology, every sub-score explained; deterministic + unit-tested. |
| Resume file parsing edge cases | Text input is primary; `mammoth`/`pdf-parse` + Claude fallback for files; validate + cap sizes. |
| Design quality of output files | Deterministic templates tuned once; ATS-safe is the *goal*, so restraint = correctness, not a compromise. |
| OKX review latency (took ~2 days for Scaminja) | Register as early as possible in P6; nudge via HackQuest TG if needed. |
| Free-demo cost (our Claude balance) | Split limiter + daily budget kill-switch + demo-cache for fixed examples (proven on Scaminja). |

---

## 11. Open decisions for the user
1. **Product name** (§6) — recommend **ClearFilter**.
2. **Domain** to point at the VPS (need one before payments/registration).
3. **Cover letter on by default?** (recommend yes — more value per call, small extra cost.)
4. **Price** — recommend **0.03 USDT/call** (above Scaminja's 0.02; higher perceived value, real files).
</content>
</invoke>
