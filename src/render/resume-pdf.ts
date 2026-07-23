import PDFDocument from "pdfkit";
import type { ResumeModel } from "../engine/schema.js";
import { PDF_FONT, PDF_MARGIN, PDF_SIZE, contactLine, expLine } from "./ats-rules.js";

/**
 * ResumeModel -> styled but still single-column, selectable-text .pdf.
 * pdfkit writes real text (not images), so this PDF is also ATS-parseable.
 */
export function renderResumePdf(r: ResumeModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: PDF_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - PDF_MARGIN * 2;
      const ink = "#111111";
      const muted = "#555555";
      const rule = "#bbbbbb";

      const heading = (text: string) => {
        doc.moveDown(0.6);
        doc.font(`${PDF_FONT}-Bold`).fontSize(PDF_SIZE.heading).fillColor(ink).text(text.toUpperCase(), { characterSpacing: 0.5 });
        const y = doc.y + 2;
        doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + pageWidth, y).lineWidth(0.7).strokeColor(rule).stroke();
        doc.moveDown(0.4);
      };
      const bullet = (text: string) => {
        doc.font(PDF_FONT).fontSize(PDF_SIZE.body).fillColor(ink);
        doc.text(`•  ${text}`, { indent: 8, paragraphGap: 2, lineGap: 1 });
      };

      // Header
      doc.font(`${PDF_FONT}-Bold`).fontSize(PDF_SIZE.name).fillColor(ink).text(r.contact.name || "Your Name");
      const contact = contactLine(r.contact);
      if (contact) doc.font(PDF_FONT).fontSize(PDF_SIZE.contact).fillColor(muted).text(contact);

      if (r.summary.trim()) {
        heading("Summary");
        doc.font(PDF_FONT).fontSize(PDF_SIZE.body).fillColor(ink).text(r.summary.trim(), { lineGap: 1 });
      }

      if (r.skills.length) {
        heading("Skills");
        doc.font(PDF_FONT).fontSize(PDF_SIZE.body).fillColor(ink).text(r.skills.join("  ·  "), { lineGap: 1 });
      }

      if (r.experience.length) {
        heading("Experience");
        for (const e of r.experience) {
          const { left, right } = expLine(e);
          const yStart = doc.y;
          doc.font(`${PDF_FONT}-Bold`).fontSize(PDF_SIZE.body).fillColor(ink).text(left, { continued: false });
          if (right) {
            doc.font(PDF_FONT).fontSize(PDF_SIZE.contact).fillColor(muted)
              .text(right, PDF_MARGIN, yStart, { width: pageWidth, align: "right" });
          }
          doc.moveDown(0.15);
          for (const b of e.bullets) bullet(b);
        }
      }

      if (r.projects.length) {
        heading("Projects");
        for (const p of r.projects) {
          doc.font(`${PDF_FONT}-Bold`).fontSize(PDF_SIZE.body).fillColor(ink)
            .text(p.name + (p.detail ? ` · ${p.detail}` : ""));
          for (const b of p.bullets) bullet(b);
        }
      }

      if (r.education.length) {
        heading("Education");
        for (const ed of r.education) {
          const left = [ed.degree, ed.field].filter(Boolean).join(", ") || ed.school;
          const right = [ed.school, [ed.start, ed.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
          const yStart = doc.y;
          doc.font(`${PDF_FONT}-Bold`).fontSize(PDF_SIZE.body).fillColor(ink).text(left);
          if (right) doc.font(PDF_FONT).fontSize(PDF_SIZE.contact).fillColor(muted)
            .text(right, PDF_MARGIN, yStart, { width: pageWidth, align: "right" });
          if (ed.detail) doc.font(PDF_FONT).fontSize(PDF_SIZE.body).fillColor(ink).text(ed.detail);
        }
      }

      if (r.certifications.length) {
        heading("Certifications");
        for (const c of r.certifications) bullet(c);
      }

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
