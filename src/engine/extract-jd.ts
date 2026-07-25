import { JDSpec } from "./schema.js";
import { parseWith } from "./claude.js";

const SYSTEM = `You are an expert technical recruiter and ATS (applicant tracking system) analyst.
Given a job description, extract a precise, structured spec of what THIS role screens for.

Rules:
- mustHaveKeywords: the 8-20 concrete hard skills, tools, technologies, methodologies, and
  domain terms an ATS keyword-filter would actually match on. Use canonical nouns
  (e.g. "Kubernetes", "financial modeling", "PostgreSQL"). No soft phrases like
  "team player" or "fast-paced". No duplicates.
- niceToHaveKeywords: preferred/bonus terms, distinct from must-haves.
- hardRequirements: only EXPLICIT gating bars actually stated (years of experience,
  degree level, named certifications, clearances). Do not invent requirements.
- responsibilities: the core outcomes/duties, so a resume can be reframed toward them.
- Be faithful to the posting. If the company or industry is not stated, use an empty string.`;

export function extractJd(jobDescription: string, model?: string): Promise<JDSpec> {
  return parseWith(JDSpec, {
    system: SYSTEM,
    content: `Job description:\n\n${jobDescription}`,
    maxTokens: 2048,
    model,
  });
}
