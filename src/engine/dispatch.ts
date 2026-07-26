import type { TailorInput } from "../types.js";
import type { TailorResult, ResumeModel } from "./schema.js";
import { extractJd } from "./extract-jd.js";
import { parseResume } from "./parse-resume.js";
import { tailor, writeCoverLetter } from "./tailor.js";
import { scoreResume } from "./score.js";
import { extractDocxText, extractPdfText } from "../parse/resume-file.js";
import { fastModel } from "./claude.js";

/** How much latency budget the run has. The paid A2MCP path uses "fast" (the buyer's HTTP
 *  client times out); the website /try path uses "quality" (a human is waiting, so quality wins). */
export interface EngineOptions {
  fast?: boolean;
}

const DISCLAIMER =
  "Resumurai reframes and sharpens your real experience. It never fabricates. Review every line and make sure each claim is accurate before you apply.";

export type EngineResult = Omit<TailorResult, "artifacts" | "evidence">;

/**
 * Deterministic backstop for the truthful-tailoring rule: a rewrite may reorder and reword,
 * but it must NEVER drop a real job, degree, or the candidate's identity. Fast models
 * occasionally omit older experience entries, which erases tenure and tanks the ATS score.
 * Rebuild from the original so every entry survives (the tailored text where the model kept
 * it, the original verbatim where it dropped it), in the original order.
 */
function preserveStructure(original: ResumeModel, tailored: ResumeModel): ResumeModel {
  const core = (s: string) => s.toLowerCase().replace(/\b(pt|cv|pte|ltd|inc|co|llc|tbk)\b/g, "").replace(/[^a-z0-9]/g, "");
  const year = (s: string) => (s.match(/\d{4}/) ?? [""])[0];
  const key = (e: ResumeModel["experience"][number]) => core(e.company) + "|" + year(e.start);

  const byKey = new Map(tailored.experience.map((e) => [key(e), e]));
  const experience = original.experience.map((orig) => byKey.get(key(orig)) ?? orig);
  const origKeys = new Set(original.experience.map(key));
  for (const t of tailored.experience) if (!origKeys.has(key(t))) experience.push(t); // defensive; normally none

  return {
    ...tailored,
    contact: {
      name: tailored.contact.name || original.contact.name,
      email: tailored.contact.email || original.contact.email,
      phone: tailored.contact.phone || original.contact.phone,
      location: tailored.contact.location || original.contact.location,
      links: tailored.contact.links?.length ? tailored.contact.links : original.contact.links,
    },
    experience,
    education: tailored.education?.length ? tailored.education : original.education,
    certifications: tailored.certifications?.length ? tailored.certifications : original.certifications,
    projects: tailored.projects?.length ? tailored.projects : original.projects,
  };
}

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
export async function runEngine(input: TailorInput, opts: EngineOptions = {}): Promise<EngineResult> {
  // In fast mode the parse/extract/tailor calls run on the quicker model so the paid
  // response beats the buyer's HTTP timeout. Quality mode leaves them on the default model.
  const m = opts.fast ? fastModel() : undefined;

  const jdText = (input.jobDescription ?? "").trim();
  if (!jdText) throw new Error("jobDescription is required (jobUrl fetching is added in a later phase)");

  // DOCX résumés are extracted to text here (Claude's document block only takes PDF/images).
  let rawResumeText = input.resume?.trim() ?? "";
  let fileForClaude: { kind: "image" | "pdf"; base64: string; mediaType: string } | undefined;
  if (input.resumeFile) {
    if (input.resumeFile.kind === "docx") {
      rawResumeText = await extractDocxText(input.resumeFile.base64);
    } else if (input.resumeFile.kind === "pdf") {
      // Fast path: pull the PDF's text layer server-side (~1s) and parse it as text.
      // Only scanned/image PDFs (no text layer) fall back to the slow vision path.
      const text = await extractPdfText(input.resumeFile.base64);
      if (text.length >= 200) {
        rawResumeText = text;
      } else {
        fileForClaude = { kind: "pdf", base64: input.resumeFile.base64, mediaType: input.resumeFile.mediaType };
      }
    } else if (input.resumeFile.kind === "image") {
      fileForClaude = { kind: "image", base64: input.resumeFile.base64, mediaType: input.resumeFile.mediaType };
    }
  }

  // Structured JD + faithful structured resume, in parallel.
  const [jd, original] = await Promise.all([
    extractJd(jdText, m),
    parseResume(fileForClaude ? { file: fileForClaude, text: rawResumeText } : { text: rawResumeText }, m),
  ]);

  // Score the ORIGINAL (formatting assessed from raw text when we have it).
  const before = scoreResume(original, jd, {
    guaranteedFormatting: false,
    rawText: rawResumeText || undefined,
  });

  const includeCover = input.options?.includeCoverLetter !== false;

  // Reforge the resume, and (when wanted) write the cover letter concurrently. The cover
  // letter draws from the ORIGINAL real resume + JD, so it needs nothing from the rewrite and
  // adds no latency to the critical path.
  const [spec, coverLetter] = await Promise.all([
    tailor(
      {
        resume: original,
        jd,
        missingKeywords: before.missingKeywords,
        unmetHardRequirements: before.unmetHardRequirements,
      },
      m,
    ),
    includeCover ? writeCoverLetter({ resume: original, jd }, m) : Promise.resolve(""),
  ]);

  // Guard against dropped jobs/degrees before scoring so the score reflects the real, complete résumé.
  const tailoredResume = preserveStructure(original, spec.resume);

  // Score the TAILORED version (our renderer guarantees ATS-safe formatting).
  const after = scoreResume(tailoredResume, jd, { guaranteedFormatting: true });

  // Reconcile the model's own two lists: a keyword can't be both truthfully "injected" and an
  // honest gap. If it landed in both, trust the conservative signal (notAddressable) and drop it
  // from injected. Deterministic, so it holds regardless of which model wrote the spec.
  const gaps = new Set(spec.notAddressable.map((k) => k.toLowerCase().trim()));
  const injectedKeywords = spec.injectedKeywords.filter((k) => !gaps.has(k.toLowerCase().trim()));

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
      injectedKeywords,
      notAddressable: spec.notAddressable,
    },
    changeNotes: spec.changeNotes,
    coverLetter,
    positioningMemo: spec.positioningMemo,
    tailoredResume,
    disclaimer: DISCLAIMER,
  };

  return deepStrip(result);
}
