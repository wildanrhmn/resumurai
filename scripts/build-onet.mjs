// Build a compact O*NET skills bundle from the public-domain database text files.
// Usage: node scripts/build-onet.mjs <path-to-db_29_1_text-dir> <out.json>
// Produces { version, tools: {soc:[names]}, titles: {normTitle: soc} }.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const out = process.argv[3] ?? "src/evidence/onet-data.json";

const rows = (file) =>
  readFileSync(path.join(dir, file), "utf8")
    .split(/\r?\n/)
    .slice(1) // header
    .filter(Boolean)
    .map((l) => l.split("\t"));

/** Normalize a job title, unifying software/eng vocabulary so titles match across taxonomies. */
function normTitle(s) {
  return s
    .toLowerCase()
    .replace(/back[\s-]?end/g, "backend")
    .replace(/front[\s-]?end/g, "frontend")
    .replace(/full[\s-]?stack/g, "fullstack")
    .replace(/\b(developer|programmer|dev|engineer)s?\b/g, "eng")
    .replace(/\b(senior|junior|lead|staff|principal|entry|mid|sr|jr|associate|intern|trainee)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- tools per SOC (hot / in-demand first, deduped, capped) ----
const toolMap = new Map(); // soc -> Map(name -> rank)
for (const [soc, name, , , hot, demand] of rows("Technology Skills.txt")) {
  if (!soc || !name) continue;
  if (!toolMap.has(soc)) toolMap.set(soc, new Map());
  const rank = (hot === "Y" ? 2 : 0) + (demand === "Y" ? 1 : 0);
  const m = toolMap.get(soc);
  m.set(name, Math.max(m.get(name) ?? 0, rank));
}
const tools = {};
for (const [soc, m] of toolMap) {
  tools[soc] = [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([n]) => n);
}

// ---- canonical occupation titles (for display) ----
const occ = {};
for (const [soc, title] of rows("Occupation Data.txt")) if (soc && title && tools[soc]) occ[soc] = title;

// ---- title -> SOC index (occupation titles + alternate titles) ----
const titles = {}; // normTitle -> soc  (prefer base .00 SOC on collision)
const add = (title, soc) => {
  const t = normTitle(title);
  if (t.length < 3) return;
  if (!(t in titles) || (soc.endsWith(".00") && !titles[t].endsWith(".00"))) titles[t] = soc;
};
for (const [soc, title] of rows("Occupation Data.txt")) if (soc && title) add(title, soc);
for (const [soc, alt] of rows("Alternate Titles.txt")) if (soc && alt) add(alt, soc);

// keep only titles whose SOC actually has tools (so a match always yields a skill list)
for (const t of Object.keys(titles)) if (!tools[titles[t]]) delete titles[t];

const bundle = { version: "O*NET 29.1", tools, titles, occ };
writeFileSync(out, JSON.stringify(bundle));
console.error(
  `[onet] ${Object.keys(tools).length} occupations with tools, ${Object.keys(titles).length} title keys -> ${out} (${(JSON.stringify(bundle).length / 1e6).toFixed(2)} MB)`,
);
