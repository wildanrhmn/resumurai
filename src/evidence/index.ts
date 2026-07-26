import type { Evidence, ResumeModel } from "../engine/schema.js";
import { metricsEvidence } from "./metrics.js";
import { reparseEvidence } from "./reparse.js";
import { skillsEvidence } from "./skills.js";
import { grammarEvidence } from "./grammar.js";

export interface EvidenceInput {
  role: string;
  resume: ResumeModel;
  docxBase64?: string;
  /** Per-source latency cap (paid path). A slow source drops individually; the fast,
   *  deterministic ones (re-parse, O*NET bundle, metrics) always survive. */
  budgetMs?: number;
}

/**
 * Gather cited, verifiable facts about the tailored résumé from external authoritative
 * sources (O*NET skill taxonomy, LanguageTool) and deterministic checks (re-parse, metrics).
 * Every source is independent and best-effort. The budget is applied PER SOURCE (not to the
 * whole batch) so one slow external source (LanguageTool) can't sink the instant ones.
 */
export async function gatherEvidence(input: EvidenceInput): Promise<Evidence[]> {
  const cap = input.budgetMs;
  const capped = (p: Promise<Evidence[]>): Promise<Evidence[]> =>
    cap && cap > 0
      ? Promise.race([p, new Promise<Evidence[]>((r) => setTimeout(() => r([]), cap))])
      : p;

  const [reparse, skills, grammar] = await Promise.all([
    capped(input.docxBase64 ? reparseEvidence(input.docxBase64, input.resume).catch(() => []) : Promise.resolve([])),
    capped(skillsEvidence(input.role, input.resume).catch(() => [])),
    capped(grammarEvidence(input.resume).catch(() => [])),
  ]);
  const metrics = metricsEvidence(input.resume); // synchronous — always included

  return [...reparse, ...skills, ...metrics, ...grammar];
}

export type { Evidence, ResumeModel };
