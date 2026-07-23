import type { TailorInput } from "./types.js";
import type { Artifact, TailorResult } from "./engine/schema.js";
import { runEngine, type EngineResult } from "./engine/dispatch.js";
import { gatherEvidence } from "./evidence/index.js";
import { renderResumeDocx } from "./render/resume-docx.js";
import { renderResumePdf } from "./render/resume-pdf.js";
import { renderCoverLetter } from "./render/cover-letter.js";
import { putArtifact } from "./artifacts/store.js";
import { slug } from "./render/ats-rules.js";

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

/** Full pipeline: engine -> rendered artifacts + evidence -> complete API result. */
export async function tailorResume(input: TailorInput): Promise<TailorResult> {
  const engine = await runEngine(input);
  return finalize(engine);
}

/**
 * Turn an engine result into the full response: render the files and gather evidence
 * (both from the same tailored résumé). Used by the live path and by demo-cache hits
 * that need fresh artifacts.
 */
export async function finalize(engine: EngineResult): Promise<TailorResult> {
  const artifacts = await buildArtifacts(engine);
  const docx = artifacts.find((a) => /-Resume\.docx$/i.test(a.filename));
  const evidence = await gatherEvidence({
    role: engine.role,
    resume: engine.tailoredResume,
    docxBase64: docx?.base64,
  });
  return { ...engine, evidence, artifacts };
}

export async function buildArtifacts(engine: {
  tailoredResume: TailorResult["tailoredResume"];
  coverLetter: string;
}): Promise<Artifact[]> {
  const name = slug(engine.tailoredResume.contact.name);
  const [docxBuf, pdfBuf] = await Promise.all([
    renderResumeDocx(engine.tailoredResume),
    renderResumePdf(engine.tailoredResume),
  ]);

  const artifacts: Artifact[] = [];
  const add = (filename: string, mimeType: string, buf: Buffer) => {
    const { id, url } = putArtifact(filename, mimeType, buf);
    artifacts.push({ id, filename, mimeType, base64: buf.toString("base64"), url });
  };

  add(`${name}-Resume.docx`, MIME.docx, docxBuf);
  add(`${name}-Resume.pdf`, MIME.pdf, pdfBuf);

  if (engine.coverLetter.trim()) {
    const coverBuf = await renderCoverLetter(engine.tailoredResume.contact, engine.coverLetter);
    add(`${name}-Cover-Letter.docx`, MIME.docx, coverBuf);
  }

  return artifacts;
}
