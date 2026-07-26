import Anthropic from "@anthropic-ai/sdk";
import { ResumeModel } from "./schema.js";
import { parseWith } from "./claude.js";

const SYSTEM = `You parse a resume into a faithful structured model. This is a LOSSLESS parse,
not an edit: transcribe exactly what is present. Do NOT rewrite, improve, add, or omit content.

- Preserve every bullet point verbatim under its employer.
- Keep dates exactly as written (e.g. "Jan 2021", "2019", "Present").
- If a field is absent, use an empty string (or empty array). Never guess.
- "skills" is a flat de-duplicated list of the skills/tools the resume actually lists or clearly demonstrates.
- If the input is an image or PDF, read all visible text including headers and contact info.`;

type FileInput = { kind: "image" | "pdf"; base64: string; mediaType: string };

/** Parse resume from plain text, or from an uploaded file (image/PDF). */
export function parseResume(
  input: { text?: string; file?: FileInput },
  model?: string,
): Promise<ResumeModel> {
  let content: string | Anthropic.Messages.MessageParam["content"];

  if (input.file) {
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];
    if (input.file.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: input.file.base64 },
      });
    } else {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: input.file.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
          data: input.file.base64,
        },
      });
    }
    if (input.text?.trim()) blocks.push({ type: "text", text: input.text });
    else blocks.push({ type: "text", text: "Parse this resume into the structured model." });
    content = blocks;
  } else {
    content = `Resume:\n\n${input.text ?? ""}`;
  }

  // High enough to transcribe a dense multi-page résumé without truncating the structured JSON.
  return parseWith(ResumeModel, { system: SYSTEM, content, maxTokens: 6144, model });
}
