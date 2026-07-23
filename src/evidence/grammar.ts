import type { Evidence, ResumeModel } from "../engine/schema.js";

/**
 * Grammar/spelling check via LanguageTool (free public API; set LANGUAGETOOL_URL to a
 * self-hosted instance in production to escape the per-IP rate limit). We disable rules
 * that fire on normal résumé bullet fragments (no leading capital / trailing period) so
 * the count reflects real spelling and grammar issues, not stylistic résumé conventions.
 */
const LT_URL = () => process.env.LANGUAGETOOL_URL ?? "https://api.languagetool.org/v2/check";

// Rules that false-positive on résumé bullet style (fragments, capitalization, spacing).
const DISABLED = [
  "UPPERCASE_SENTENCE_START",
  "SENTENCE_WHITESPACE",
  "WHITESPACE_RULE",
  "COMMA_PARENTHESIS_WHITESPACE",
  "PUNCTUATION_PARAGRAPH_END",
  "EN_QUOTES",
].join(",");

function resumeProse(r: ResumeModel): string {
  const parts: string[] = [];
  if (r.summary.trim()) parts.push(r.summary.trim());
  for (const e of r.experience) for (const b of e.bullets) if (b.trim()) parts.push(b.trim());
  return parts.join("\n").slice(0, 18_000);
}

export async function grammarEvidence(resume: ResumeModel): Promise<Evidence[]> {
  const text = resumeProse(resume);
  if (text.length < 40) return [];

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const body = new URLSearchParams({ text, language: "en-US", disabledRules: DISABLED });
    const res = await fetch(LT_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { matches?: { rule?: { issueType?: string } }[] };
    const matches = json.matches ?? [];
    // Count real issues; ignore purely stylistic/typographical noise.
    const issues = matches.filter((m) => {
      const it = m.rule?.issueType ?? "";
      return it === "misspelling" || it === "grammar" || it === "duplication" || it === "confused_words";
    }).length;

    return [
      {
        label: "Grammar & spelling",
        detail:
          issues === 0
            ? "LanguageTool found no spelling or grammar issues in the tailored résumé."
            : `LanguageTool flagged ${issues} spelling/grammar issue${issues === 1 ? "" : "s"} to review.`,
        source: "LanguageTool",
        status: issues === 0 ? "pass" : issues <= 2 ? "warn" : "info",
      },
    ];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
