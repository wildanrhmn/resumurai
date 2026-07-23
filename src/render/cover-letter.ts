import { Document, Packer, Paragraph, TextRun } from "docx";
import type { ResumeContact } from "../engine/schema.js";
import { FONT, MARGIN_TWIP, SIZE, contactLine } from "./ats-rules.js";

/** Cover letter text -> a clean .docx Buffer, headed with the candidate's contact block. */
export async function renderCoverLetter(contact: ResumeContact, text: string): Promise<Buffer> {
  const children: Paragraph[] = [];

  if (contact.name)
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: contact.name, bold: true, size: SIZE.name, font: FONT })],
      }),
    );
  const cl = contactLine(contact);
  if (cl)
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: cl, size: SIZE.contact, font: FONT, color: "444444" })],
      }),
    );

  for (const para of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: para.replace(/\n/g, " "), size: SIZE.body, font: FONT })],
      }),
    );
  }

  const doc = new Document({
    creator: "Resumurai",
    title: `${contact.name || "Cover Letter"} — Cover Letter`,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: MARGIN_TWIP, bottom: MARGIN_TWIP, left: MARGIN_TWIP, right: MARGIN_TWIP } },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
