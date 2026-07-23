import { describe, expect, it } from "vitest";
import { coverage, keywordPresent, normalizeText, resumeToText } from "../src/engine/normalize.js";
import { scoreResume } from "../src/engine/score.js";
import type { JDSpec, ResumeModel } from "../src/engine/schema.js";

const jd: JDSpec = {
  role: "Senior Backend Engineer",
  company: "Acme",
  seniority: "senior",
  industry: "fintech",
  mustHaveKeywords: ["Kubernetes", "PostgreSQL", "Go", "REST API", "AWS", "gRPC"],
  niceToHaveKeywords: ["Terraform", "Kafka"],
  hardRequirements: [
    { requirement: "5+ years backend experience", kind: "experience_years", detail: "5" },
    { requirement: "Bachelor's degree", kind: "degree", detail: "bachelor" },
    { requirement: "AWS certification", kind: "certification", detail: "AWS Certified" },
  ],
  responsibilities: ["design services", "own reliability"],
};

const weak: ResumeModel = {
  contact: { name: "Jane Dev", email: "jane@x.com", phone: "555", location: "NYC", links: [] },
  summary: "Backend engineer.",
  experience: [
    {
      company: "Startup",
      title: "Engineer",
      location: "NYC",
      start: "2021",
      end: "Present",
      bullets: ["Built services with k8s and postgres", "Wrote REST APIs in Golang"],
    },
  ],
  skills: ["Go", "PostgreSQL", "Kubernetes", "REST"],
  education: [{ school: "State U", degree: "B.Sc.", field: "CS", start: "2016", end: "2020", detail: "" }],
  certifications: [],
  projects: [],
};

describe("normalize", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeText("Node.js, React!!  and   C++")).toBe("node.js react and c++");
  });

  it("matches synonyms (k8s -> Kubernetes, postgres -> PostgreSQL)", () => {
    const text = normalizeText("Deployed on k8s with a postgres backend");
    expect(keywordPresent("Kubernetes", text)).toBe(true);
    expect(keywordPresent("PostgreSQL", text)).toBe(true);
  });

  it("does not match java inside javascript", () => {
    const text = normalizeText("Strong in JavaScript and TypeScript");
    expect(keywordPresent("Java", text)).toBe(false);
    expect(keywordPresent("JavaScript", text)).toBe(true);
  });

  it("coverage computes ratio + missing", () => {
    const c = coverage(["Kubernetes", "Rust", "Go"], normalizeText("I use kubernetes and go daily"));
    expect(c.matched.sort()).toEqual(["Go", "Kubernetes"]);
    expect(c.missing).toEqual(["Rust"]);
    expect(c.ratio).toBeCloseTo(2 / 3, 5);
  });
});

describe("scoreResume", () => {
  it("guaranteedFormatting yields a perfect formatting sub-score", () => {
    const r = scoreResume(weak, jd, { guaranteedFormatting: true });
    expect(r.score.formatting.score).toBe(100);
  });

  it("flags the missing must-have keyword (gRPC) and unmet cert", () => {
    const r = scoreResume(weak, jd, { guaranteedFormatting: false });
    expect(r.missingKeywords).toContain("gRPC");
    expect(r.missingKeywords).toContain("AWS");
    expect(r.unmetHardRequirements).toContain("AWS certification");
    // has a 4-year degree ending 2020 -> not 5 years yet in some years; cert is the clear miss
    expect(r.unmetHardRequirements).not.toContain("Bachelor's degree");
  });

  it("overall score is 0-100 and formatting-guaranteed version scores higher", () => {
    const before = scoreResume(weak, jd, { guaranteedFormatting: false });
    const after = scoreResume(weak, jd, { guaranteedFormatting: true });
    for (const s of [before, after]) {
      expect(s.score.overall).toBeGreaterThanOrEqual(0);
      expect(s.score.overall).toBeLessThanOrEqual(100);
    }
    expect(after.score.overall).toBeGreaterThanOrEqual(before.score.overall);
  });

  it("resumeToText includes bullets and skills", () => {
    const t = resumeToText(weak);
    expect(t).toContain("golang");
    expect(t).toContain("kubernetes");
  });
});
