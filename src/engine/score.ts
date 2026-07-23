import type { AtsScore, JDSpec, ResumeModel, SubScore } from "./schema.js";
import { coverage, keywordPresent, normalizeText, resumeToText } from "./normalize.js";

/**
 * Deterministic, explainable ATS scoring. NEVER call the model here.
 * Weights: keywordCoverage 40% · hardRequirements 25% · formatting 20% · completeness 15%.
 */

const W = { keyword: 0.4, hard: 0.25, formatting: 0.2, completeness: 0.15 } as const;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface ScoreOutput {
  score: AtsScore;
  missingKeywords: string[]; // missing must-haves (the actionable gap list)
  unmetHardRequirements: string[];
}

export interface ScoreOpts {
  /** True for our rendered output — formatting is guaranteed ATS-safe. */
  guaranteedFormatting: boolean;
  /** Raw original text (before-scoring only) to sniff layout red flags. */
  rawText?: string;
}

/* ───────────────────────── keyword coverage (40%) ──────────────────────── */

function scoreKeywords(resume: ResumeModel, jd: JDSpec): { sub: SubScore; missing: string[] } {
  const text = resumeToText(resume);
  const must = coverage(jd.mustHaveKeywords, text);
  const nice = coverage(jd.niceToHaveKeywords, text);
  const pct = jd.niceToHaveKeywords.length
    ? 0.85 * must.ratio + 0.15 * nice.ratio
    : must.ratio;
  const reason =
    must.missing.length === 0
      ? `Covers all ${jd.mustHaveKeywords.length} priority keywords for this role.`
      : `Missing ${must.missing.length}/${jd.mustHaveKeywords.length} priority keywords: ${must.missing
          .slice(0, 8)
          .join(", ")}${must.missing.length > 8 ? "…" : ""}.`;
  return { sub: { score: clamp(pct * 100), reason }, missing: must.missing };
}

/* ──────────────────────── hard requirements (25%) ──────────────────────── */

function totalYearsExperience(resume: ResumeModel): number {
  const now = new Date().getFullYear();
  let years = 0;
  for (const e of resume.experience) {
    const sy = Number((e.start.match(/\d{4}/) ?? [])[0]);
    const endRaw = e.end.toLowerCase();
    const ey = /present|current|now/.test(endRaw)
      ? now
      : Number((e.end.match(/\d{4}/) ?? [])[0]);
    if (Number.isFinite(sy) && Number.isFinite(ey) && ey >= sy) years += ey - sy;
  }
  return years;
}

function requirementMet(req: JDSpec["hardRequirements"][number], resume: ResumeModel, text: string): boolean {
  const detail = req.detail.toLowerCase();
  switch (req.kind) {
    case "experience_years": {
      const need = Number((req.detail.match(/\d+/) ?? [])[0]);
      if (!Number.isFinite(need)) return true;
      return totalYearsExperience(resume) >= need;
    }
    case "degree": {
      const has = resume.education.some((ed) => (ed.degree + " " + ed.field).trim().length > 0);
      if (!has) return false;
      if (/phd|doctor/.test(detail))
        return resume.education.some((ed) => /phd|doctor/i.test(ed.degree));
      if (/master|m\.s|msc|mba/.test(detail))
        return resume.education.some((ed) => /master|m\.?s|msc|mba|phd|doctor/i.test(ed.degree));
      return has; // bachelor's or unspecified: any degree qualifies
    }
    case "certification":
      return (
        resume.certifications.some((c) => keywordPresent(req.requirement, normalizeText(c))) ||
        keywordPresent(req.requirement, text)
      );
    case "skill":
      return keywordPresent(req.requirement, text) || keywordPresent(req.detail, text);
    default:
      // clearance / other: only creditable if literally evidenced in the text
      return keywordPresent(req.requirement, text);
  }
}

function scoreHardRequirements(resume: ResumeModel, jd: JDSpec): { sub: SubScore; unmet: string[] } {
  const text = resumeToText(resume);
  if (jd.hardRequirements.length === 0)
    return { sub: { score: 100, reason: "No explicit gating requirements in the posting." }, unmet: [] };
  const unmet: string[] = [];
  for (const req of jd.hardRequirements) if (!requirementMet(req, resume, text)) unmet.push(req.requirement);
  const met = jd.hardRequirements.length - unmet.length;
  const reason =
    unmet.length === 0
      ? `Meets all ${jd.hardRequirements.length} gating requirements.`
      : `Unmet: ${unmet.join("; ")}.`;
  return { sub: { score: clamp((met / jd.hardRequirements.length) * 100), reason }, unmet };
}

/* ─────────────────────────── formatting (20%) ──────────────────────────── */

function scoreFormatting(resume: ResumeModel, opts: ScoreOpts): SubScore {
  if (opts.guaranteedFormatting)
    return {
      score: 100,
      reason: "Single-column, standard headings, no tables or graphics, cleanly parseable by any ATS.",
    };

  let score = 100;
  const flags: string[] = [];
  const raw = opts.rawText ?? "";

  // Layout red flags an ATS parser chokes on.
  if (/[│|┃╎]/.test(raw) || /\|\s*\w.*\|\s*\w/.test(raw)) {
    score -= 25;
    flags.push("table/pipe layout");
  }
  const wideGaps = (raw.match(/\S {4,}\S/g) ?? []).length;
  if (wideGaps > 12) {
    score -= 20;
    flags.push("multi-column spacing");
  }
  if (/[•▪◦‣·]/.test(raw) === false && resume.experience.some((e) => e.bullets.length > 0) && raw) {
    // ok — bullets may have been normalized away; not penalized
  }
  // Structural completeness signals.
  if (!resume.contact.email) {
    score -= 15;
    flags.push("no parseable email");
  }
  if (!resume.contact.name) {
    score -= 10;
    flags.push("no clear name line");
  }
  if (resume.experience.some((e) => !/\d{4}/.test(e.start))) {
    score -= 10;
    flags.push("unparseable dates");
  }

  const reason = flags.length ? `Parsing risks: ${flags.join(", ")}.` : "Reasonably parseable, minor risk.";
  return { score: clamp(score), reason };
}

/* ────────────────────────── completeness (15%) ─────────────────────────── */

function scoreCompleteness(resume: ResumeModel): SubScore {
  let score = 0;
  const notes: string[] = [];

  if (resume.summary.trim().length >= 40) score += 20;
  else notes.push("no summary");

  const bullets = resume.experience.flatMap((e) => e.bullets);
  const quantified = bullets.filter((b) => /\d/.test(b)).length;
  const qRatio = bullets.length ? quantified / bullets.length : 0;
  score += Math.round(qRatio * 40);
  if (qRatio < 0.3) notes.push("few quantified achievements");

  if (resume.skills.length >= 5) score += 15;
  else notes.push("thin skills section");

  if (resume.education.length > 0) score += 10;
  else notes.push("no education listed");

  if (bullets.length >= 6) score += 15;
  else notes.push("sparse experience detail");

  const reason = notes.length ? `Could improve: ${notes.join(", ")}.` : "Well-rounded and detailed.";
  return { score: clamp(score), reason };
}

/* ─────────────────────────────── combine ───────────────────────────────── */

export function scoreResume(resume: ResumeModel, jd: JDSpec, opts: ScoreOpts): ScoreOutput {
  const kw = scoreKeywords(resume, jd);
  const hard = scoreHardRequirements(resume, jd);
  const formatting = scoreFormatting(resume, opts);
  const completeness = scoreCompleteness(resume);

  const overall = clamp(
    kw.sub.score * W.keyword +
      hard.sub.score * W.hard +
      formatting.score * W.formatting +
      completeness.score * W.completeness,
  );

  return {
    score: {
      overall,
      keywordCoverage: kw.sub,
      hardRequirements: hard.sub,
      formatting,
      completeness,
    },
    missingKeywords: kw.missing,
    unmetHardRequirements: hard.unmet,
  };
}
