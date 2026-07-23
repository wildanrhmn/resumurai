import "dotenv/config";
import { writeFileSync } from "node:fs";
import { tailorResume } from "../src/pipeline.js";

const OUT = process.argv[2] ?? ".";

const resume = `Alex Chen
alexchen@email.com | Austin, TX

WORK
Backend Developer, PayStream Inc (2019 - Present)
- Responsible for a bunch of payment services that handle a lot of transactions
- Used Go and also some Python for scripts
- We deployed everything on Amazon and used containers
- Set up automated build and release stuff so we could ship faster
- Worked with the databases, mostly Postgres, and made APIs for other teams
- On call for incidents, tried to keep things reliable

Software Engineer, DataCorp (2016 - 2019)
- Wrote microservices and message queue consumers with Kafka
- Did code reviews and mentored two junior engineers
- Built dashboards and improved monitoring

SKILLS
Go, Python, Postgres, Docker, k8s, AWS, Kafka, Jenkins, REST, Terraform

EDUCATION
BS Computer Science, UT Austin (2012-2016)`;

const jobDescription = `Senior Backend Engineer — Fintech Payments

Requirements:
- 5+ years of backend software engineering experience
- Expert in Go (Golang) and building microservices
- PostgreSQL and relational data modeling
- Strong AWS experience; Docker and Kubernetes in production
- CI/CD pipelines
- REST API design; event-driven systems with Kafka
- Bachelor's degree in Computer Science or equivalent

Responsibilities:
- Design and operate reliable payment microservices at scale
- Own observability and incident response
- Mentor engineers and lead technical design`;

const t0 = Date.now();
const r = await tailorResume({ resume, jobDescription });
console.log(`\nATS ${r.ats.scoreBefore} -> ${r.ats.scoreAfter}  (${Date.now() - t0} ms)`);
console.log("artifacts:");
for (const a of r.artifacts) {
  const buf = Buffer.from(a.base64, "base64");
  writeFileSync(`${OUT}/${a.filename}`, buf);
  console.log(`  ${a.filename.padEnd(28)} ${buf.length} bytes  url=${a.url}`);
}
console.log("\nSummary:", r.tailoredResume.summary.slice(0, 160), "…");
