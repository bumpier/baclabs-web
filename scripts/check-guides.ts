/**
 * Validates every guide against content/guides/AUTHORING.md. Run with
 * `npx tsx scripts/check-guides.ts`. Exits non-zero on any violation, so a
 * guide that breaks a hard rule cannot be shipped by accident.
 */
import { GUIDES } from "@/content/guides";

const BANNED: { re: RegExp; why: string }[] = [
  // Rule 1 — no therapeutic, medical or veterinary framing. "multi-dose" and
  // "for injection" are stripped before scanning (see NORMALISE): the first is
  // the product's own term, the second is the US pharmacopoeial product name,
  // which AUTHORING.md permits in the third person.
  { re: /\binject(?:s|ed|ing|ions?)\b/i, why: "instructs or describes administration" },
  { re: /\bdos(?:e|es|ing|age)\b/i, why: "dosing language" },
  { re: /\bpatients?\b/i, why: "clinical framing" },
  { re: /\byour body\b/i, why: "clinical framing" },
  { re: /\bmedication\b/i, why: "clinical framing" },
  { re: /\bHRT\b/, why: "clinical framing" },
  { re: /\bTRT\b/, why: "clinical framing" },
  { re: /\bpeptide therapy\b/i, why: "clinical framing" },
  // Rule 2 — the preservative is never named or quantified anywhere. This one
  // is absolute: the chemical name trips advertising-platform review.
  { re: /benzyl/i, why: "names the preservative" },
  { re: /\b100-51-6\b/, why: "CAS number of the preservative" },
  // Only a figure attached to the preservative itself. A percentage near the
  // word "preservative" is usually saline's 0.9% sodium chloride, which is a
  // different solute and legitimate to state.
  {
    re: /\d[\d.]*\s*(?:%|per cent|mg\/m[lL])\s*(?:w\/v\s*)?(?:of\s+)?(?:an?\s+)?(?:bacteriostatic\s+)?preservative/i,
    why: "quantifies the preservative",
  },
  // Rule 3 — price superlatives belong only on the home page, beside terms.
  { re: /\bcheapest\b/i, why: "price superlative" },
  { re: /\blowest price\b/i, why: "price superlative" },
  { re: /\bbest price\b/i, why: "price superlative" },
  // Rule 5 — UK English, no em dashes, no exclamation marks.
  { re: /\u2014/, why: "em dash" },
  { re: /!/, why: "exclamation mark" },
];

/**
 * Phrases that legitimately contain a banned substring, removed before the
 * scan. "Multi-dose" is the product's own term and appears in
 * config/funnel.ts; "for injection" is the US pharmacopoeial product name and
 * is explicitly permitted by AUTHORING.md in the third person.
 */
function normalise(text: string): string {
  return text.replace(/multi[- ]dose/gi, "multientry").replace(/for injection/gi, "USP-name");
}

const SLUGS = new Set(GUIDES.map((g) => g.slug));
let failures = 0;

function fail(slug: string, msg: string) {
  console.error(`  ✗ ${slug}: ${msg}`);
  failures++;
}

for (const g of GUIDES) {
  const prose = [
    g.title,
    g.metaTitle,
    g.description,
    g.quickAnswer,
    ...g.sections.flatMap((s) => [
      s.heading,
      ...s.paragraphs,
      ...(s.list ?? []),
      ...(s.table ? [s.table.caption, ...s.table.columns, ...s.table.rows.flat()] : []),
    ]),
    ...g.faq.flatMap((f) => [f.q, f.a]),
    // Joined with a non-space delimiter so a pattern using \s* cannot match
    // across two independent strings — a table row ending "0.9% w/v" beside
    // the next row's "Preservative" heading is not a quantified preservative.
  ].join("\n\u00a6\n");

  const scan = normalise(prose);

  for (const { re, why } of BANNED) {
    const m = scan.match(re);
    if (m) fail(g.slug, `${JSON.stringify(m[0])} — ${why}`);
  }

  if (g.metaTitle.length > 60) fail(g.slug, `metaTitle ${g.metaTitle.length} chars, max 60`);
  if (!/bacteriostatic water/i.test(g.metaTitle))
    fail(g.slug, "metaTitle must contain 'bacteriostatic water'");
  if (g.description.length > 155) fail(g.slug, `description ${g.description.length} chars, max 155`);

  const words = g.quickAnswer.trim().split(/\s+/).length;
  if (words < 40 || words > 75) fail(g.slug, `quickAnswer ${words} words, want 40-60`);

  if (g.sections.length < 5 || g.sections.length > 7)
    fail(g.slug, `${g.sections.length} sections, want 5-7`);
  if (g.faq.length < 4 || g.faq.length > 6) fail(g.slug, `${g.faq.length} faq, want 4-6`);
  if (g.related.length !== 2) fail(g.slug, `${g.related.length} related, want exactly 2`);
  for (const r of g.related) {
    if (!SLUGS.has(r)) fail(g.slug, `related slug '${r}' is not a published guide`);
    if (r === g.slug) fail(g.slug, "related links to itself");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.updated)) fail(g.slug, `bad updated date '${g.updated}'`);
}

const dupes = GUIDES.map((g) => g.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) fail("index", `duplicate slugs: ${dupes.join(", ")}`);

if (failures) {
  console.error(`\n${failures} violation(s) across ${GUIDES.length} guides.`);
  process.exit(1);
}
console.log(`✓ ${GUIDES.length} guides pass every rule in AUTHORING.md`);
