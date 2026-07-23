import { z } from "zod";

/**
 * Resumurai schemas.
 *
 * Three are LLM structured-output contracts (each .describe() doubles as a model
 * instruction): JDSpec (extract the job), ResumeModel (faithfully parse the resume),
 * TailoringSpec (rewrite the resume + cover letter + memo).
 *
 * AtsScore is produced deterministically in code, never by the model.
 * TailorResult is the final public API response.
 */

/* ─────────────────────────── Structured resume ─────────────────────────── */

export const ExperienceItem = z.object({
  company: z.string().describe("Employer / organization name."),
  title: z.string().describe("Job title held."),
  location: z.string().nullable().describe("City/remote, or null if absent."),
  start: z.string().describe('Start date as written, e.g. "Jan 2021" or "2021".'),
  end: z.string().describe('End date as written, or "Present".'),
  bullets: z
    .array(z.string())
    .describe("Achievement/responsibility bullet points, verbatim from the resume."),
});
export type ExperienceItem = z.infer<typeof ExperienceItem>;

export const EducationItem = z.object({
  school: z.string(),
  degree: z.string().describe('e.g. "B.Sc. Computer Science", or "" if unknown.'),
  field: z.string().describe("Field of study, or empty string."),
  start: z.string().describe("Start year or empty string."),
  end: z.string().describe("End/graduation year or empty string."),
  detail: z.string().describe("GPA, honors, coursework — or empty string."),
});
export type EducationItem = z.infer<typeof EducationItem>;

export const ResumeContact = z.object({
  name: z.string().describe("Candidate full name, or empty string if not present."),
  email: z.string().describe("Email, or empty string."),
  phone: z.string().describe("Phone, or empty string."),
  location: z.string().describe("City/region, or empty string."),
  links: z.array(z.string()).describe("LinkedIn/GitHub/portfolio URLs. Empty array if none."),
});
export type ResumeContact = z.infer<typeof ResumeContact>;

export const ResumeModel = z.object({
  contact: ResumeContact,
  summary: z.string().describe("Professional summary / objective. Empty string if none."),
  experience: z.array(ExperienceItem),
  skills: z.array(z.string()).describe("Flat list of skills/tools/technologies."),
  education: z.array(EducationItem),
  certifications: z.array(z.string()).describe("Certifications/licenses. Empty array if none."),
  projects: z
    .array(
      z.object({
        name: z.string(),
        detail: z.string().describe("One-line description."),
        bullets: z.array(z.string()),
      }),
    )
    .describe("Notable projects. Empty array if none."),
});
export type ResumeModel = z.infer<typeof ResumeModel>;

/* ────────────────────────── Job-description spec ───────────────────────── */

export const HardRequirement = z.object({
  requirement: z.string().describe('Short label, e.g. "5+ years backend experience".'),
  kind: z
    .enum(["experience_years", "degree", "certification", "skill", "clearance", "other"])
    .describe("Category of the requirement."),
  detail: z.string().describe("The specific bar, e.g. '5' for years, 'AWS SA-Pro' for a cert."),
});
export type HardRequirement = z.infer<typeof HardRequirement>;

export const JDSpec = z.object({
  role: z.string().describe("The job title being hired for."),
  company: z.string().describe("Hiring company, or empty string if not stated."),
  seniority: z
    .enum(["intern", "entry", "mid", "senior", "lead", "manager", "director", "exec", "unknown"])
    .describe("Seniority level implied by the posting."),
  industry: z.string().describe("Industry/domain, or empty string."),
  mustHaveKeywords: z
    .array(z.string())
    .describe(
      "The 8-20 hard skills, tools, technologies, and domain terms an ATS would key on for THIS role. Concrete nouns only (e.g. 'Kubernetes', 'financial modeling'), not soft phrases.",
    ),
  niceToHaveKeywords: z
    .array(z.string())
    .describe("Secondary/preferred keywords that strengthen a match. Empty array if none."),
  hardRequirements: z
    .array(HardRequirement)
    .describe("Explicit gating requirements (years, degree, certs, clearances)."),
  responsibilities: z
    .array(z.string())
    .describe("Key responsibilities/outcomes the role owns — used to reframe resume bullets."),
});
export type JDSpec = z.infer<typeof JDSpec>;

/* ───────────────────────────── Tailoring spec ──────────────────────────── */

export const TailoringSpec = z.object({
  resume: ResumeModel.describe(
    "The REWRITTEN resume, tailored to the target role. Same real experience, reframed and reworded to surface relevant impact and truthfully incorporate the job's keywords. NEVER invent employers, titles, dates, or accomplishments.",
  ),
  injectedKeywords: z
    .array(z.string())
    .describe("Job keywords you were able to truthfully weave in (candidate has real basis for each)."),
  notAddressable: z
    .array(z.string())
    .describe(
      "Job keywords/requirements you could NOT honestly add because the resume shows no basis for them. Report as gaps — do not fabricate to close them.",
    ),
  changeNotes: z
    .array(z.string())
    .describe("Short human-readable notes on what you changed and why (3-8 items)."),
  coverLetter: z
    .string()
    .describe(
      "A tailored, professional cover letter (~180-300 words) addressed to the role/company, grounded only in the candidate's real experience.",
    ),
  positioningMemo: z
    .string()
    .describe(
      "2-5 sentences of candid coaching: why this candidate can clear the filter for this role, what to emphasize in interviews, and the honest gaps to shore up.",
    ),
});
export type TailoringSpec = z.infer<typeof TailoringSpec>;

/* ─────────────────────── ATS score (deterministic) ─────────────────────── */

export interface SubScore {
  score: number; // 0-100
  reason: string;
}

export interface AtsScore {
  overall: number; // 0-100 weighted
  keywordCoverage: SubScore; // 40%
  hardRequirements: SubScore; // 25%
  formatting: SubScore; // 20%
  completeness: SubScore; // 15%
}

/* ─────────────────── Evidence (external + deterministic) ────────────────── */

export type EvidenceStatus = "pass" | "warn" | "info";

/** A cited, verifiable fact about the tailored résumé — not the model's opinion. */
export interface Evidence {
  label: string; // short claim, e.g. "ATS parse check"
  detail: string; // human sentence with the specifics
  source: string; // "ESCO" | "O*NET" | "LanguageTool" | "Re-parse" | "Metrics"
  status: EvidenceStatus;
}

/* ─────────────────────────── Public API result ─────────────────────────── */

export interface Artifact {
  id: string;
  filename: string;
  mimeType: string;
  base64: string;
  url: string; // relative /artifacts/:id
}

export interface TailorResult {
  role: string;
  company: string;
  ats: {
    scoreBefore: number;
    scoreAfter: number;
    before: AtsScore;
    after: AtsScore;
  };
  gaps: {
    missingKeywords: string[];
    unmetHardRequirements: string[];
    injectedKeywords: string[];
    notAddressable: string[];
  };
  changeNotes: string[];
  coverLetter: string;
  positioningMemo: string;
  tailoredResume: ResumeModel;
  evidence: Evidence[];
  artifacts: Artifact[];
  disclaimer: string;
}
