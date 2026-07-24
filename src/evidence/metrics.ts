import type { Evidence, ResumeModel } from "../engine/schema.js";

/**
 * Deterministic résumé-quality metrics. These are computed, not judged by the model,
 * so they're reproducible evidence a reviewer can re-derive.
 */

const ACTION_VERBS = new Set([
  "led", "built", "designed", "developed", "implemented", "launched", "delivered", "improved",
  "increased", "reduced", "owned", "drove", "created", "managed", "shipped", "architected",
  "optimized", "automated", "scaled", "migrated", "established", "engineered", "spearheaded",
  "streamlined", "orchestrated", "deployed", "operated", "mentored", "coordinated", "negotiated",
  "generated", "grew", "cut", "saved", "accelerated", "modernized", "rebuilt", "founded", "ran",
  "produced", "directed", "authored", "analyzed", "resolved", "secured", "integrated",
]);

const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";

/** A bullet leads with an action verb if the first word is a known verb or a past-tense (-ed) verb. */
function leadsWithActionVerb(bullet: string): boolean {
  const w = firstWord(bullet);
  return ACTION_VERBS.has(w) || (w.length > 3 && w.endsWith("ed"));
}

export function metricsEvidence(r: ResumeModel): Evidence[] {
  const bullets = r.experience.flatMap((e) => e.bullets).filter((b) => b.trim().length > 0);
  const out: Evidence[] = [];
  if (bullets.length === 0) return out;

  const quantified = bullets.filter((b) => /\d/.test(b)).length;
  const qPct = Math.round((quantified / bullets.length) * 100);
  out.push({
    label: "Quantified impact",
    detail: `${qPct}% of experience bullets (${quantified}/${bullets.length}) include a concrete number or metric.`,
    source: "Metrics",
    status: qPct >= 50 ? "pass" : qPct >= 25 ? "warn" : "info",
  });

  const strong = bullets.filter(leadsWithActionVerb).length;
  const vPct = Math.round((strong / bullets.length) * 100);
  out.push({
    label: "Strong action verbs",
    detail: `${vPct}% of bullets (${strong}/${bullets.length}) lead with a strong action verb.`,
    source: "Metrics",
    status: vPct >= 60 ? "pass" : vPct >= 35 ? "warn" : "info",
  });

  return out;
}
