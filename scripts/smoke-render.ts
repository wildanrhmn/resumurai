import { writeFileSync } from "node:fs";
import { renderResumeDocx } from "../src/render/resume-docx.js";
import { renderResumePdf } from "../src/render/resume-pdf.js";
import { renderCoverLetter } from "../src/render/cover-letter.js";
import type { ResumeModel } from "../src/engine/schema.js";

const OUT = process.argv[2] ?? ".";

const r: ResumeModel = {
  contact: { name: "Alex Chen", email: "alexchen@email.com", phone: "(512) 555-0148", location: "Austin, TX", links: ["linkedin.com/in/alexchen"] },
  summary: "Senior Backend Engineer with 9 years building high-throughput payment microservices in fintech. Deep experience in Go, PostgreSQL, event-driven systems with Kafka, and containerized deployments on AWS with Docker and Kubernetes.",
  experience: [
    { company: "PayStream Inc", title: "Backend Developer", location: "Austin, TX", start: "2019", end: "Present",
      bullets: [
        "Designed and operated payment microservices processing high transaction volumes in production.",
        "Built core services in Go, with Python for automation and operational scripting.",
        "Deployed containerized services on AWS using Docker and Kubernetes.",
        "Implemented CI/CD pipelines to automate build, test, and release.",
      ] },
    { company: "DataCorp", title: "Software Engineer", location: "Austin, TX", start: "2016", end: "2019",
      bullets: [
        "Built microservices and Kafka message-queue consumers for event-driven data flows.",
        "Mentored two junior engineers and led code reviews.",
      ] },
  ],
  skills: ["Go", "Python", "PostgreSQL", "Docker", "Kubernetes", "AWS", "Kafka", "CI/CD", "REST API design", "Terraform"],
  education: [{ school: "UT Austin", degree: "B.S.", field: "Computer Science", start: "2012", end: "2016", detail: "" }],
  certifications: ["AWS Certified Solutions Architect – Associate"],
  projects: [],
};

const cover = `Dear Hiring Team,

I'm excited to apply for the Senior Backend Engineer role. For the past nine years I've designed and operated payment microservices at scale, working hands-on with Go, PostgreSQL, and Kafka-based event-driven systems.

At PayStream I owned reliability for services handling high transaction volumes, built CI/CD pipelines, and ran containerized workloads on AWS with Kubernetes. I'd bring that same end-to-end ownership to your team.

Thank you for your consideration.

Sincerely,
Alex Chen`;

const docx = await renderResumeDocx(r);
const pdf = await renderResumePdf(r);
const cov = await renderCoverLetter(r.contact, cover);

writeFileSync(`${OUT}/sample-resume.docx`, docx);
writeFileSync(`${OUT}/sample-resume.pdf`, pdf);
writeFileSync(`${OUT}/sample-cover-letter.docx`, cov);

const magic = (b: Buffer) => b.subarray(0, 4).toString("latin1");
console.log(`docx: ${docx.length} bytes  magic=${JSON.stringify(magic(docx))} (expect PK\\u0003\\u0004)`);
console.log(`pdf : ${pdf.length} bytes  magic=${JSON.stringify(magic(pdf))} (expect %PDF)`);
console.log(`cover: ${cov.length} bytes  magic=${JSON.stringify(magic(cov))}`);
console.log(`wrote sample-resume.docx / .pdf / sample-cover-letter.docx to ${OUT}`);
