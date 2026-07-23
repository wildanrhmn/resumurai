import "dotenv/config";
import { runEngine } from "../src/engine/dispatch.js";

// A genuinely-qualified candidate whose resume is UNOPTIMIZED:
// no summary, weak verbs, skills buried, JD's exact terms not used.
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
const r = await runEngine({ resume, jobDescription });
const ms = Date.now() - t0;

console.log("\n=== STRONG-CANDIDATE SMOKE ===");
console.log(`role: ${r.role} @ ${r.company}   (${ms} ms)`);
console.log(`ATS: ${r.ats.scoreBefore}  ->  ${r.ats.scoreAfter}`);
console.log("  before:", Object.fromEntries(Object.entries(r.ats.before).filter(([k]) => k !== "overall").map(([k, v]: any) => [k, v.score])));
console.log("  after :", Object.fromEntries(Object.entries(r.ats.after).filter(([k]) => k !== "overall").map(([k, v]: any) => [k, v.score])));
console.log("\nmissing (before):", r.gaps.missingKeywords);
console.log("injected:", r.gaps.injectedKeywords);
console.log("notAddressable:", r.gaps.notAddressable);
console.log("\nNEW SUMMARY:\n ", r.tailoredResume.summary);
console.log("\nTAILORED BULLETS (job 1):");
for (const b of r.tailoredResume.experience[0]?.bullets ?? []) console.log("  •", b);
console.log("\nemployers preserved:", r.tailoredResume.experience.map((e) => e.company));
