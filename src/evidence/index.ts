import type { Evidence, ResumeModel } from "../engine/schema.js";
import { metricsEvidence } from "./metrics.js";
import { reparseEvidence } from "./reparse.js";
import { skillsEvidence } from "./skills.js";
import { grammarEvidence } from "./grammar.js";

export interface EvidenceInput {
  role: string;
  resume: ResumeModel;
  docxBase64?: string;
}

/**
 * Gather cited, verifiable facts about the tailored résumé from external authoritative
 * sources (ESCO/O*NET skill taxonomy, LanguageTool) and deterministic checks (re-parse,
 * metrics). Every source is independent and best-effort: a slow or failing source is
 * dropped, never blocking the result. Ordered for readability.
 */
export async function gatherEvidence(input: EvidenceInput): Promise<Evidence[]> {
  const [reparse, skills, grammar] = await Promise.all([
    input.docxBase64 ? reparseEvidence(input.docxBase64, input.resume).catch(() => []) : Promise.resolve([]),
    skillsEvidence(input.role, input.resume).catch(() => []),
    grammarEvidence(input.resume).catch(() => []),
  ]);
  const metrics = metricsEvidence(input.resume);

  return [...reparse, ...skills, ...metrics, ...grammar];
}

export type { Evidence, ResumeModel };
