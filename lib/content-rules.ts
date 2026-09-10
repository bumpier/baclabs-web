/**
 * The copy rules from content/guides/AUTHORING.md, as pure functions.
 *
 * These moved out of scripts/check-guides.ts so that the admin publish action
 * can enforce them too. The script was a pre-commit courtesy; a publish button
 * is a way to put unreviewed prose on the live site, so the same rules now sit
 * in the publish path where they cannot be forgotten.
 *
 * Pure by design: no Prisma import, no DB access, no `server-only`. It is
 * called from a tsx script, a server action and a client component alike.
 */
import type { Guide } from "@/content/guides/types";
import type { Post } from "@/content/posts/types";

export type Violation = {
  /** Which part of the article is at fault, for the editor's violations panel. */
  field: string;
  /** The offending text, or the measured value. */
  match: string;
  /** Why it is not publishable, in the author's language. */
  why: string;
};

export const BANNED: { re: RegExp; why: string }[] = [
  // Rule 1 - no therapeutic, medical or veterinary framing. "multi-dose" and
  // "for injection" are stripped by normalise() before scanning.
  { re: /\binject(?:s|ed|ing|ions?)\b/i, why: "instructs or describes administration" },
  { re: /\bdos(?:e|es|ing|age)\b/i, why: "dosing language" },
  { re: /\bpatients?\b/i, why: "clinical framing" },
  { re: /\byour body\b/i, why: "clinical framing" },
  { re: /\bmedication\b/i, why: "clinical framing" },
  { re: /\bHRT\b/, why: "clinical framing" },
  { re: /\bTRT\b/, why: "clinical framing" },
  { re: /\bpeptide therapy\b/i, why: "clinical framing" },
  // Rule 2 - the preservative is never named or quantified anywhere. This one
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
  // Rule 3 - price superlatives belong only on the home page, beside terms.
  { re: /\bcheapest\b/i, why: "price superlative" },
  { re: /\blowest price\b/i, why: "price superlative" },
  { re: /\bbest price\b/i, why: "price superlative" },
  // Rule 5 - UK English, no em dashes, no exclamation marks.
  { re: /—/, why: "em dash" },
  { re: /!/, why: "exclamation mark" },
];

/**
 * Phrases that legitimately contain a banned substring, removed before the
 * scan. "Multi-dose" is the product's own term and appears in
 * config/funnel.ts; "for injection" is the US pharmacopoeial product name and
 * is explicitly permitted by AUTHORING.md in the third person.
 */
export function normalise(text: string): string {
  return text.replace(/multi[- ]dose/gi, "multientry").replace(/for injection/gi, "USP-name");
}

/**
 * Joined with a non-space delimiter so a pattern using \s* cannot match across
 * two independent strings - a table row ending "0.9% w/v" beside the next
 * row's "Preservative" heading is not a quantified preservative.
 *
 * Changing this to " " or "\n" reintroduces that false positive. There is a
 * test for it in scripts/test-content-rules.ts.
 */
const DELIMITER = "\n¦\n";

/** Every string in a guide that a reader can see, in document order. */
export function guideProse(g: Guide): string[] {
  return [
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
  ];
}

/**
 * Every string in a post that a reader can see. The markdown body is scanned
 * as raw text: a banned word is on the page whether or not it sits inside
 * markup, and the alternative (rendering to HTML first) would let a rule be
 * evaded by splitting a word across emphasis markers.
 */
export function postProse(p: Post): string[] {
  return [p.title, p.metaTitle, p.description, p.excerpt, p.markdown];
}

/** The compliance scan. Applies identically to guides and posts. */
export function checkCompliance(texts: string[]): Violation[] {
  const scan = normalise(texts.join(DELIMITER));
  const out: Violation[] = [];
  for (const { re, why } of BANNED) {
    const m = scan.match(re);
    if (m) out.push({ field: "content", match: m[0], why });
  }
  return out;
}

/** Structural rules. Guides only - posts are deliberately exempt. */
export function checkGuideStructure(g: Guide, publishedSlugs: Set<string>): Violation[] {
  const out: Violation[] = [];
  const add = (field: string, match: string, why: string) => out.push({ field, match, why });

  if (g.metaTitle.length > 60)
    add("metaTitle", `${g.metaTitle.length} chars`, "meta title is over 60 characters");
  if (!/bacteriostatic water/i.test(g.metaTitle))
    add("metaTitle", g.metaTitle, "meta title must contain 'bacteriostatic water'");
  if (g.description.length > 155)
    add("description", `${g.description.length} chars`, "description is over 155 characters");

  // 40-75, not 40-60: see the note in this plan's Task 1, Step 1. The old
  // message said 40-60 while the code enforced 40-75; the code won.
  const words = g.quickAnswer.trim() === "" ? 0 : g.quickAnswer.trim().split(/\s+/).length;
  if (words < 40 || words > 75)
    add("quickAnswer", `${words} words`, "quick answer must be 40 to 75 words");

  if (g.sections.length < 5 || g.sections.length > 7)
    add("sections", `${g.sections.length}`, "a guide needs 5 to 7 sections");
  if (g.faq.length < 4 || g.faq.length > 6)
    add("faq", `${g.faq.length}`, "a guide needs 4 to 6 FAQ entries");
  if (g.related.length !== 2)
    add("related", `${g.related.length}`, "a guide needs exactly 2 related guides");

  for (const r of g.related) {
    if (r === g.slug) add("related", r, "a guide cannot link to itself");
    else if (!publishedSlugs.has(r)) add("related", r, "related slug is not a published guide");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.updated))
    add("updated", g.updated, "date must be YYYY-MM-DD");

  return out;
}

/** Structural rules for a post. Deliberately minimal. */
export function checkPostStructure(p: Post): Violation[] {
  const out: Violation[] = [];
  const add = (field: string, match: string, why: string) => out.push({ field, match, why });

  if (p.metaTitle.length > 60)
    add("metaTitle", `${p.metaTitle.length} chars`, "meta title is over 60 characters");
  if (p.description.length > 155)
    add("description", `${p.description.length} chars`, "description is over 155 characters");
  if (p.markdown.trim() === "") add("markdown", "empty", "a post needs a body");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.updated)) add("updated", p.updated, "date must be YYYY-MM-DD");

  return out;
}
