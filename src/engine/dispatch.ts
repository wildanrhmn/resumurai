import type { TailorInput } from "../types.js";
import type { TailorResult } from "./schema.js";
import { extractJd } from "./extract-jd.js";
import { parseResume } from "./parse-resume.js";
import { tailor } from "./tailor.js";
import { scoreResume } from "./score.js";
import { extractDocxText } from "../parse/resume-file.js";

const DISCLAIMER =
  "Resumurai reframes and sharpens your real experience. It never fabricates. Review every line and make sure each claim is accurate before you apply.";

export type EngineResult = Omit<TailorResult, "artifacts">;

/** Remove em dashes everywhere (deterministic guarantee, independent of the model). */
function stripEm(s: string): string {
  return s.replace(/\s*—\s*/g, ", ").replace(/,\s*,/g, ",");
}
function deepStrip<T>(v: T): T {
  if (typeof v === "string") return stripEm(v) as unknown as T;
  if (Array.isArray(v)) return v.map(deepStrip) as unknown as T;
  if (v && typeof v === "object") {
    for (const k of Object.keys(v as object)) (v as Record<string, unknown>)[k] = deepStrip((v as Record<string, unknown>)[k]);
    return v;
  }
  return v;
}

/**
 * Full analyze -> score(before) -> tailor -> score(after) pipeline, WITHOUT file rendering.
 * Rendering (artifacts) is layered on in src/render. This keeps the engine offline-testable.
 */
export async function runEngine(input: TailorInput): Promise<EngineResult> {
  const jdText = (input.jobDescription ?? "").trim();
  if (!jdText) throw new Error("jobDescription is required (jobUrl fetching is added in a later phase)");

  // DOCX résumés are extracted to text here (Claude's document block only takes PDF/images).
  let rawResumeText = input.resume?.trim() ?? "";
  let fileForClaude: { kind: "image" | "pdf"; base64: string; mediaType: string } | undefined;
  if (input.resumeFile) {
    if (input.resumeFile.kind === "docx") {
      rawResumeText = await extractDocxText(input.resumeFile.base64);
    } else if (input.resumeFile.kind === "pdf" || input.resumeFile.kind === "image") {
      fileForClaude = {
        kind: input.resumeFile.kind,
        base64: input.resumeFile.base64,
        mediaType: input.resumeFile.mediaType,
      };
    }
  }

  // Structured JD + faithful structured resume, in parallel.
  const [jd, original] = await Promise.all([
    extractJd(jdText),
    parseResume(fileForClaude ? { file: fileForClaude, text: rawResumeText } : { text: rawResumeText }),
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

  const result: EngineResult = {
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

  return deepStrip(result);
}
