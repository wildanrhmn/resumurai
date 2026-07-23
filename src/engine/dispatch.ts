import type { TailorInput } from "../types.js";
import type { TailorResult } from "./schema.js";
import { extractJd } from "./extract-jd.js";
import { parseResume } from "./parse-resume.js";
import { tailor } from "./tailor.js";
import { scoreResume } from "./score.js";

const DISCLAIMER =
  "Resumurai reframes and sharpens your real experience — it never fabricates. Review every line and make sure each claim is accurate before you apply.";

export type EngineResult = Omit<TailorResult, "artifacts">;

/**
 * Full analyze -> score(before) -> tailor -> score(after) pipeline, WITHOUT file rendering.
 * Rendering (artifacts) is layered on in src/render. This keeps the engine offline-testable.
 */
export async function runEngine(input: TailorInput): Promise<EngineResult> {
  const jdText = (input.jobDescription ?? "").trim();
  if (!jdText) throw new Error("jobDescription is required (jobUrl fetching is added in a later phase)");

  const rawResumeText = input.resume?.trim() ?? "";

  // Structured JD + faithful structured resume, in parallel.
  const [jd, original] = await Promise.all([
    extractJd(jdText),
    parseResume(
      input.resumeFile ? { file: input.resumeFile, text: input.resume } : { text: rawResumeText },
    ),
  ]);

  // Score the ORIGINAL (formatting assessed from raw text when we have it).
  const before = scoreResume(original, jd, {
    guaranteedFormatting: false,
    rawText: rawResumeText || undefined,
  });

  // Reforge.
  const spec = await tailor({
    resume: original,
    jd,
    missingKeywords: before.missingKeywords,
    unmetHardRequirements: before.unmetHardRequirements,
  });

  // Score the TAILORED version (our renderer guarantees ATS-safe formatting).
  const after = scoreResume(spec.resume, jd, { guaranteedFormatting: true });

  const includeCover = input.options?.includeCoverLetter !== false;

  return {
    role: jd.role,
    company: jd.company,
    ats: {
      scoreBefore: before.score.overall,
      scoreAfter: after.score.overall,
      before: before.score,
      after: after.score,
    },
    gaps: {
      missingKeywords: before.missingKeywords,
      unmetHardRequirements: before.unmetHardRequirements,
      injectedKeywords: spec.injectedKeywords,
      notAddressable: spec.notAddressable,
    },
    changeNotes: spec.changeNotes,
    coverLetter: includeCover ? spec.coverLetter : "",
    positioningMemo: spec.positioningMemo,
    tailoredResume: spec.resume,
    disclaimer: DISCLAIMER,
  };
}
