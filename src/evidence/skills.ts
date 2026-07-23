import type { Evidence, ResumeModel } from "../engine/schema.js";
import { keywordPresent, resumeToText } from "../engine/normalize.js";

/**
 * Ground the role's real technology/skill requirements in O*NET — the US Dept of Labor's
 * occupational standard. Unlike ESCO (whose abstract EU competences don't cover modern
 * tools — "Kubernetes"/"Docker" aren't even in it), O*NET's technology-skills lists are
 * concrete tool names, which is exactly what an ATS keys on.
 *
 * Requires a free API key (ONET_API_KEY, from services.onetcenter.org/developer/signup).
 * Without the key this source is silently skipped; the rest of the evidence layer still runs.
 */
const ONET = "https://api-v2.onetcenter.org";
const key = () => process.env.ONET_API_KEY ?? "";

async function oget(path: string, timeoutMs = 6000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${ONET}${path}`, {
      headers: { "X-API-Key": key(), Accept: "application/json" },
      signal: ctrl.signal,
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const SENIORITY = /\b(senior|junior|lead|staff|principal|entry|mid|sr|jr|associate|intern|trainee)\b/gi;
function cleanRole(role: string): string {
  const c = role.replace(/,.*$/, "").replace(/[-–—].*$/, "").replace(SENIORITY, "").replace(/\s+/g, " ").trim();
  return c.length >= 3 ? c : role.trim();
}

/** Collect concrete tool names from an O*NET technology_skills payload (defensive to shape). */
function extractTools(payload: any): string[] {
  const tools = new Set<string>();
  const walkExamples = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walkExamples);
    for (const [k, v] of Object.entries(node)) {
      if (k === "example" && Array.isArray(v)) {
        for (const e of v) {
          const name = typeof e === "string" ? e : (e as { name?: string; title?: string })?.name ?? (e as { title?: string })?.title;
          if (name) tools.add(String(name));
        }
      } else {
        walkExamples(v);
      }
    }
  };
  walkExamples(payload);
  return [...tools];
}

export async function skillsEvidence(role: string, resume: ResumeModel): Promise<Evidence[]> {
  if (!key() || !role.trim()) return [];

  const search = await oget(`/online/search?keyword=${encodeURIComponent(cleanRole(role))}&start=1&end=5`);
  const occ = search?.occupation?.[0];
  if (!occ?.code) return [];

  const tech = await oget(`/online/occupations/${occ.code}/summary/technology_skills`);
  const tools = extractTools(tech);
  if (tools.length < 3) return [];

  const text = resumeToText(resume);
  const covered = tools.filter((t) => keywordPresent(t, text));
  const pct = Math.round((covered.length / tools.length) * 100);

  return [
    {
      label: "Role tech skills (O*NET)",
      detail: `O*NET lists ${tools.length} key technologies for “${occ.title}”; your résumé covers ${covered.length} (${pct}%).`,
      source: "O*NET",
      status: pct >= 50 ? "pass" : pct >= 25 ? "warn" : "info",
    },
  ];
}
