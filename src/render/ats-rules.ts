/**
 * Shared ATS-safe formatting rules. The whole point of the renderer is that these
 * constraints are guaranteed in CODE, not left to a model or a template the user edits:
 *   - single column, no tables / text-boxes / images / headers-footers
 *   - standard section headings in a conventional order
 *   - standard fonts, black text, real bullet glyphs, parseable dates
 * That guarantee is what lets the "after" formatting sub-score be a legitimate 100.
 */

export const FONT = "Calibri"; // ubiquitous, parses cleanly everywhere
export const PDF_FONT = "Helvetica";

// docx sizes are half-points.
export const SIZE = {
  name: 32, // 16pt
  heading: 24, // 12pt
  body: 22, // 11pt
  contact: 20, // 10pt
};

export const PDF_SIZE = { name: 18, heading: 12, body: 10.5, contact: 9.5 };

export const MARGIN_TWIP = 1080; // 0.75in in twips (1in = 1440)
export const PDF_MARGIN = 54; // 0.75in in points (1in = 72)

/** Canonical section order an ATS expects. */
export const SECTION_ORDER = [
  "SUMMARY",
  "SKILLS",
  "EXPERIENCE",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
] as const;

export function contactLine(c: {
  email: string;
  phone: string;
  location: string;
  links: string[];
}): string {
  return [c.email, c.phone, c.location, ...c.links].map((s) => s.trim()).filter(Boolean).join("  |  ");
}

export function slug(name: string): string {
  const s = name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "Resume";
}

export function expLine(e: {
  title: string;
  company: string;
  location: string | null;
  start: string;
  end: string;
}): { left: string; right: string } {
  const left = [e.title, e.company].filter(Boolean).join(" — ");
  const dates = [e.start, e.end].filter(Boolean).join(" – ");
  const right = [e.location, dates].filter(Boolean).join(" · ");
  return { left, right };
}
