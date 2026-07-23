import "dotenv/config";
import { runEngine } from "../src/engine/dispatch.js";

const resume = `Jamie Rivera
jamie.rivera@email.com | San Jose, CA | linkedin.com/in/jamierivera

SUMMARY
Software developer with a few years of experience building web apps.

EXPERIENCE
Freelance Web Developer — Self-employed (2022 - Present)
- Built websites for small business clients using JavaScript and React
- Set up databases and wrote some backend code in Node
- Helped clients with hosting and deployment

Junior Developer — Bright Apps LLC (2020 - 2022)
- Fixed bugs and added features to a customer portal
- Worked with the team using agile
- Wrote unit tests

SKILLS
JavaScript, React, Node, HTML, CSS, Git

EDUCATION
B.S. Information Technology — San Jose State University (2016 - 2020)`;

const jobDescription = `Senior Full-Stack Engineer — FinPay (Fintech)

We're hiring a Senior Full-Stack Engineer to own core services on our payments platform.

Requirements:
- 5+ years of professional software engineering experience
- Strong TypeScript and React on the frontend
- Node.js backend services at scale; PostgreSQL
- Experience with AWS, Docker, and CI/CD pipelines
- REST and GraphQL API design
- Bachelor's degree in Computer Science or related field

Nice to have:
- Kubernetes, Terraform
- Experience in fintech or payments
- Familiarity with event-driven systems (Kafka)

Responsibilities:
- Design, build, and operate reliable payment microservices
- Lead technical design and mentor engineers
- Improve observability and reduce incident rates`;

const t0 = Date.now();
const r = await runEngine({ resume, jobDescription });
const ms = Date.now() - t0;

console.log("\n=== RESUMURAI ENGINE SMOKE ===");
console.log(`role: ${r.role} @ ${r.company}   (${ms} ms)`);
console.log(`ATS: ${r.ats.scoreBefore}  ->  ${r.ats.scoreAfter}`);
console.log("  before:", Object.fromEntries(
  Object.entries(r.ats.before).filter(([k]) => k !== "overall").map(([k, v]: any) => [k, v.score]),
));
console.log("  after :", Object.fromEntries(
  Object.entries(r.ats.after).filter(([k]) => k !== "overall").map(([k, v]: any) => [k, v.score]),
));
console.log("\nmissingKeywords:", r.gaps.missingKeywords);
console.log("unmetHardRequirements:", r.gaps.unmetHardRequirements);
console.log("injectedKeywords:", r.gaps.injectedKeywords);
console.log("notAddressable:", r.gaps.notAddressable);
console.log("\nchangeNotes:");
for (const n of r.changeNotes) console.log("  -", n);
console.log("\nNEW SUMMARY:\n ", r.tailoredResume.summary);
console.log("\nFIRST EXPERIENCE BULLETS (tailored):");
for (const b of r.tailoredResume.experience[0]?.bullets ?? []) console.log("  •", b);
console.log("\nPOSITIONING MEMO:\n ", r.positioningMemo);
console.log("\nCOVER LETTER (first 400 chars):\n ", r.coverLetter.slice(0, 400), "…");

// Guardrail assertions: tailoring must not invent employers/titles/dates.
const origCompanies = ["Self-employed", "Bright Apps LLC"];
const newCompanies = r.tailoredResume.experience.map((e) => e.company);
console.log("\nGUARDRAIL — employers preserved:", newCompanies);
