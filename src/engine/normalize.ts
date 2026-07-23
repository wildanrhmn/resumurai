/**
 * Keyword normalization + synonym matching for ATS scoring.
 * Deterministic and dependency-free — this is the substrate the score is built on,
 * so it must be predictable and unit-testable.
 */

/** Lowercase, keep alphanumerics + a few tech-significant chars (+ # .), collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical -> variants. If ANY variant appears in the resume, the keyword is covered.
 * Kept intentionally small and high-signal; extend as needed.
 */
const SYNONYM_GROUPS: string[][] = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["node.js", "nodejs", "node js", "node"],
  ["kubernetes", "k8s"],
  ["postgresql", "postgres", "psql"],
  ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery"],
  ["golang", "go lang"],
  ["react.js", "reactjs", "react js", "react"],
  ["next.js", "nextjs", "next js"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["rest api", "restful", "rest apis", "rest"],
  ["graphql", "graph ql"],
  ["object oriented", "oop", "object-oriented"],
  ["test driven development", "tdd"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["search engine optimization", "seo"],
  ["customer relationship management", "crm"],
  ["key performance indicator", "kpi", "kpis"],
  ["objectives and key results", "okr", "okrs"],
  ["profit and loss", "p&l", "p l", "pnl"],
  ["structured query language", "sql"],
  ["extract transform load", "etl"],
  ["quality assurance", "qa"],
  ["software as a service", "saas"],
  ["financial modeling", "financial modelling", "fin modeling"],
];

const VARIANT_TO_GROUP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  const normed = group.map(normalizeText);
  for (const v of normed) VARIANT_TO_GROUP.set(v, normed);
}

/** All normalized surface forms to look for, given a keyword. */
export function variantsOf(keyword: string): string[] {
  const k = normalizeText(keyword);
  const group = VARIANT_TO_GROUP.get(k);
  const set = new Set<string>([k]);
  if (group) for (const v of group) set.add(v);
  return [...set].filter(Boolean);
}

// Generic head/tail nouns that carry no keyword signal on their own — dropped when
// matching a multi-word keyword by tokens (so "REST API design" ≈ "REST" + "API").
const GENERIC = new Set([
  "design", "designs", "system", "systems", "management", "development", "engineering",
  "experience", "skills", "tools", "framework", "frameworks", "platform", "platforms",
  "solution", "solutions", "based", "related", "strong", "knowledge", "proficiency",
  "using", "various", "environment", "environments", "technologies", "technology",
]);
const STOP = new Set(["and", "or", "the", "with", "of", "in", "for", "to", "a", "an", "on", "at", "as", "is"]);

/** Light singularization: drop a trailing "s" on longer tokens (apis→api, pipelines→pipeline). */
function singular(t: string): string {
  return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
}

/** Split normalized text into meaningful, singularized tokens. */
function tokenize(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP.has(t))
    .map(singular);
}

/** Significant (non-generic) tokens of a keyword phrase. */
function significantTokens(normalizedVariant: string): string[] {
  return tokenize(normalizedVariant).filter((t) => !GENERIC.has(t));
}

/**
 * Is `keyword` present in an already-normalized resume text?
 * - single-token: token (singularized) must appear as a whole token ("java" ≠ "javascript").
 * - multi-word: exact phrase, OR all significant (non-generic) tokens present individually.
 * Synonyms are honored throughout.
 */
export function keywordPresent(keyword: string, normalizedResume: string): boolean {
  const haystack = ` ${normalizedResume} `;
  const tokens = new Set(tokenize(normalizedResume));
  for (const v of variantsOf(keyword)) {
    if (!v) continue;
    if (v.includes(" ")) {
      if (haystack.includes(` ${v} `)) return true;
      const sig = significantTokens(v);
      if (sig.length > 0 && sig.every((t) => tokens.has(t))) return true;
    } else if (tokens.has(singular(v))) {
      return true;
    }
  }
  return false;
}

/** Coverage = fraction of the keyword list present. Returns matched + missing. */
export function coverage(
  keywords: string[],
  normalizedResume: string,
): { matched: string[]; missing: string[]; ratio: number } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    if (!kw.trim()) continue;
    if (keywordPresent(kw, normalizedResume)) matched.push(kw);
    else missing.push(kw);
  }
  const total = matched.length + missing.length;
  return { matched, missing, ratio: total === 0 ? 1 : matched.length / total };
}

/** Flatten a resume-like object to searchable normalized text. */
export function resumeToText(r: {
  summary?: string;
  skills?: string[];
  certifications?: string[];
  experience?: { title: string; company: string; bullets: string[] }[];
  projects?: { name: string; detail: string; bullets: string[] }[];
  education?: { school: string; degree: string; field: string; detail: string }[];
}): string {
  const parts: string[] = [];
  if (r.summary) parts.push(r.summary);
  if (r.skills) parts.push(r.skills.join(" "));
  if (r.certifications) parts.push(r.certifications.join(" "));
  for (const e of r.experience ?? []) {
    parts.push(e.title, e.company, ...e.bullets);
  }
  for (const p of r.projects ?? []) {
    parts.push(p.name, p.detail, ...p.bullets);
  }
  for (const ed of r.education ?? []) {
    parts.push(ed.school, ed.degree, ed.field, ed.detail);
  }
  return normalizeText(parts.join(" \n "));
}
