import type { TailorInput } from "../types.js";

export class ValidationError extends Error {}

const MAX_TEXT = () => Number(process.env.MAX_TEXT_CHARS ?? 60_000);
const MAX_FILE_BYTES = () => Number(process.env.MAX_FILE_BYTES ?? 6_000_000);

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Validate + normalize the request body into a TailorInput. Throws ValidationError. */
export function validateInput(body: unknown): TailorInput {
  if (typeof body !== "object" || body === null) throw new ValidationError("Request body must be a JSON object.");
  const b = body as Record<string, unknown>;

  const resume = typeof b.resume === "string" ? b.resume : undefined;
  const jobDescription = typeof b.jobDescription === "string" ? b.jobDescription : undefined;
  const jobUrl = typeof b.jobUrl === "string" ? b.jobUrl : undefined;

  if (resume && resume.length > MAX_TEXT()) throw new ValidationError(`resume exceeds ${MAX_TEXT()} characters.`);
  if (jobDescription && jobDescription.length > MAX_TEXT())
    throw new ValidationError(`jobDescription exceeds ${MAX_TEXT()} characters.`);

  let resumeFile: TailorInput["resumeFile"];
  if (b.resumeFile && typeof b.resumeFile === "object") {
    const f = b.resumeFile as Record<string, unknown>;
    const kind = f.kind === "pdf" ? "pdf" : f.kind === "image" ? "image" : null;
    if (!kind) throw new ValidationError('resumeFile.kind must be "pdf" or "image".');
    if (typeof f.base64 !== "string" || !f.base64) throw new ValidationError("resumeFile.base64 is required.");
    const bytes = Math.floor((f.base64.length * 3) / 4);
    if (bytes > MAX_FILE_BYTES()) throw new ValidationError(`resumeFile exceeds ${MAX_FILE_BYTES()} bytes.`);
    const mediaType = typeof f.mediaType === "string" ? f.mediaType : kind === "pdf" ? "application/pdf" : "image/png";
    if (kind === "pdf" && mediaType !== "application/pdf")
      throw new ValidationError("PDF resumeFile.mediaType must be application/pdf.");
    if (kind === "image" && !IMAGE_TYPES.has(mediaType))
      throw new ValidationError(`Unsupported image type ${mediaType}.`);
    resumeFile = { kind, base64: f.base64, mediaType };
  }

  if (!resume?.trim() && !resumeFile) throw new ValidationError("Provide a resume (text) or resumeFile.");
  if (!jobDescription?.trim() && !jobUrl?.trim())
    throw new ValidationError("Provide a jobDescription (text) or jobUrl.");

  const opts = (b.options ?? {}) as Record<string, unknown>;
  return {
    resume,
    resumeFile,
    jobDescription,
    jobUrl,
    options: {
      includeCoverLetter: opts.includeCoverLetter !== false,
      tone: typeof opts.tone === "string" ? opts.tone : undefined,
      targetRole: typeof opts.targetRole === "string" ? opts.targetRole : undefined,
    },
  };
}
