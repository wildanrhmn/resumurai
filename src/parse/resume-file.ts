import mammoth from "mammoth";
import { getDocumentProxy, extractText } from "unpdf";

/**
 * Extract plain text from a .docx (base64). Claude's document block only accepts
 * PDF/images, so DOCX résumés are converted to text server-side, then parsed the
 * same way as pasted text.
 */
export async function extractDocxText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

/**
 * Extract plain text from a PDF (base64). Text PDFs (the common case for résumés
 * exported from Word/Docs) parse here in ~1s, far faster than sending the whole file
 * through the model's vision path (~25-30s). Returns "" if the PDF has no extractable
 * text layer (e.g. a scanned image), so the caller can fall back to the vision path.
 */
export async function extractPdfText(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, "base64");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // mergePages:true returns a single joined string.
    const { text } = await extractText(pdf, { mergePages: true });
    return (text ?? "").trim();
  } catch {
    return "";
  }
}
