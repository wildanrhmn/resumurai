import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import type { ResumeModel } from "../engine/schema.js";
import { FONT, MARGIN_TWIP, SIZE, contactLine, expLine } from "./ats-rules.js";

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    border: { bottom: { color: "999999", size: 6, space: 2, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: SIZE.heading, font: FONT })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    indent: { left: 260, hanging: 180 },
    spacing: { after: 40 },
    children: [new TextRun({ text: `•  ${text}`, size: SIZE.body, font: FONT })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, size: SIZE.body, font: FONT })],
  });
}

/** ResumeModel -> ATS-safe .docx Buffer. */
export async function renderResumeDocx(r: ResumeModel): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Header: name + contact (plain paragraphs, never a table/header).
  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: r.contact.name || "Your Name", bold: true, size: SIZE.name, font: FONT })],
    }),
  );
  const contact = contactLine(r.contact);
  if (contact)
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: contact, size: SIZE.contact, font: FONT, color: "444444" })],
      }),
    );

  if (r.summary.trim()) {
    children.push(heading("Summary"), body(r.summary.trim()));
  }

  if (r.skills.length) {
    children.push(heading("Skills"), body(r.skills.join("  ·  ")));
  }

  if (r.experience.length) {
    children.push(heading("Experience"));
    for (const e of r.experience) {
      const { left, right } = expLine(e);
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: left, bold: true, size: SIZE.body, font: FONT }),
            ...(right ? [new TextRun({ text: `\t${right}`, size: SIZE.body, font: FONT, color: "444444" })] : []),
          ],
        }),
      );
      for (const b of e.bullets) children.push(bullet(b));
    }
  }

  if (r.projects.length) {
    children.push(heading("Projects"));
    for (const p of r.projects) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
          children: [
            new TextRun({ text: p.name, bold: true, size: SIZE.body, font: FONT }),
            ...(p.detail ? [new TextRun({ text: ` · ${p.detail}`, size: SIZE.body, font: FONT })] : []),
          ],
        }),
      );
      for (const b of p.bullets) children.push(bullet(b));
    }
  }

  if (r.education.length) {
    children.push(heading("Education"));
    for (const ed of r.education) {
      const left = [ed.degree, ed.field].filter(Boolean).join(", ");
      const right = [ed.school, [ed.start, ed.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: left || ed.school, bold: true, size: SIZE.body, font: FONT }),
            ...(right ? [new TextRun({ text: `\t${right}`, size: SIZE.body, font: FONT, color: "444444" })] : []),
          ],
        }),
      );
      if (ed.detail) children.push(body(ed.detail));
    }
  }

  if (r.certifications.length) {
    children.push(heading("Certifications"));
    for (const c of r.certifications) children.push(bullet(c));
  }

  const doc = new Document({
    creator: "Resumurai",
    title: `${r.contact.name || "Resume"} · Resume`,
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
