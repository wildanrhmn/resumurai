import "dotenv/config";
import { writeFileSync } from "node:fs";
import { runEngine } from "../src/engine/dispatch.js";
import { buildArtifacts } from "../src/pipeline.js";
import { gatherEvidence } from "../src/evidence/index.js";
import { demoKey } from "../src/demo/cache.js";

/**
 * Regenerate the $0 demo cache. KEEP THESE EXAMPLES IN SYNC with
 * web/src/components/examples.ts (same resume + jobDescription strings) so the exact
 * text the site posts hits the cache. Run: npm run gen:demo-cache
 */
const EXAMPLES = [
  {
    resume: `Alex Chen
alexchen@email.com | Austin, TX

WORK
Backend Developer, PayStream Inc (2019 - Present)
- Responsible for payment services handling about 2 million transactions a day
- Used Go and some Python for scripts
- Deployed everything on Amazon and used containers
- Set up automated build and release, cut deploy time by about 40%
- Worked with the databases, mostly Postgres, and made APIs for other teams
- On call for incidents, tried to keep things reliable
Software Engineer, DataCorp (2016 - 2019)
- Wrote microservices and message queue consumers with Kafka
- Did code reviews and mentored two junior engineers

SKILLS
Go, Python, Postgres, Docker, k8s, AWS, Kafka, Jenkins, REST

EDUCATION
BS Computer Science, UT Austin (2012-2016)`,
    jobDescription: `Senior Backend Engineer, Fintech Payments

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
- Mentor engineers and lead technical design`,
  },
  {
    resume: `Priya Nair
priya.nair@email.com | Remote

EXPERIENCE
Marketing Manager, BrightLeaf SaaS (2020 - Present)
- Ran campaigns across email and social and grew signups
- Wrote blog posts and case studies and some landing pages
- Worked with sales on messaging and did a few product launches
- Looked at funnel numbers in the analytics tool and reported to leadership
Marketing Associate, Nomad Tools (2018 - 2020)
- Helped with events and content and managed the social calendar

SKILLS
Copywriting, Email, Social media, Google Analytics, Canva

EDUCATION
BA Communications, University of Michigan (2014-2018)`,
    jobDescription: `Senior Product Marketing Manager, B2B SaaS

Requirements:
- 5+ years in product marketing for B2B SaaS
- Proven go-to-market (GTM) strategy and product launch ownership
- Positioning and messaging frameworks
- Demand generation and funnel/conversion analytics
- Sales enablement content
- Strong cross-functional leadership

Responsibilities:
- Own GTM strategy and lead product launches
- Build positioning, messaging, and competitive narratives
- Partner with demand gen on pipeline and with sales on enablement`,
  },
];

const out = process.argv[2] ?? "src/demo/demo-cache.json";
const cache: Record<string, unknown> = {};

for (const [i, ex] of EXAMPLES.entries()) {
  process.stderr.write(`[gen] example ${i + 1}/${EXAMPLES.length} …\n`);
  const result = await runEngine(ex);
  const artifacts = await buildArtifacts(result);
  const docx = artifacts.find((a) => /-Resume\.docx$/i.test(a.filename));
  const evidence = await gatherEvidence({ role: result.role, resume: result.tailoredResume, docxBase64: docx?.base64 });
  cache[demoKey(ex.resume, ex.jobDescription)] = { ...result, evidence };
  process.stderr.write(`      ${result.role}: ${result.ats.scoreBefore} -> ${result.ats.scoreAfter} · ${evidence.length} evidence\n`);
}

writeFileSync(out, JSON.stringify(cache, null, 2));
process.stderr.write(`[gen] wrote ${Object.keys(cache).length} entries to ${out}\n`);
