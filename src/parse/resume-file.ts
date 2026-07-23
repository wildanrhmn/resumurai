import mammoth from "mammoth";

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
