import type { TailorInput } from "./types.js";
import type { Artifact, TailorResult } from "./engine/schema.js";
import { runEngine } from "./engine/dispatch.js";
import { renderResumeDocx } from "./render/resume-docx.js";
import { renderResumePdf } from "./render/resume-pdf.js";
import { renderCoverLetter } from "./render/cover-letter.js";
import { putArtifact } from "./artifacts/store.js";
import { slug } from "./render/ats-rules.js";

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

/** Full pipeline: engine -> rendered artifacts -> complete API result. */
export async function tailorResume(input: TailorInput): Promise<TailorResult> {
  const engine = await runEngine(input);
  const artifacts = await buildArtifacts(engine);
  return { ...engine, artifacts };
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
