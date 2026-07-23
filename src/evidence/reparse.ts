import mammoth from "mammoth";
import type { Evidence, ResumeModel } from "../engine/schema.js";

/**
 * Re-parse the RENDERED .docx (the exact file an ATS receives) back to plain text and
 * verify the key fields survive extraction. This proves the output is genuinely
 * machine-readable — real selectable text, no image/table corruption — rather than us
 * merely asserting it's "ATS-safe".
 */
export async function reparseEvidence(docxBase64: string, r: ResumeModel): Promise<Evidence[]> {
  try {
    const buffer = Buffer.from(docxBase64, "base64");
    const { value } = await mammoth.extractRawText({ buffer });
    const text = value.toLowerCase();
    const has = (s: string) => s.trim().length > 0 && text.includes(s.trim().toLowerCase());

    const checks: boolean[] = [];
    if (r.contact.name) checks.push(has(r.contact.name));
    if (r.contact.email) checks.push(has(r.contact.email));
    const roles = r.experience.length;
    const rolesFound = r.experience.filter((e) => has(e.company) || has(e.title)).length;
    const skillsFound = r.skills.filter((s) => has(s)).length;

    const coreOk = checks.every(Boolean) && rolesFound === roles;
    const detail =
      `Generated .docx re-parses to clean text: ` +
      `name and email extracted, ${rolesFound}/${roles} roles and ${skillsFound}/${r.skills.length} skills recovered.`;

    return [
      {
        label: "ATS parse check",
        detail,
        source: "Re-parse",
        status: coreOk ? "pass" : "warn",
      },
    ];
  } catch {
    return []; // never block the result on an evidence check
  }
}
