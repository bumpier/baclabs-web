/**
 * The copy rules from content/guides/AUTHORING.md, as pure functions.
 *
 * These moved out of scripts/check-guides.ts so that the admin publish action
 * can enforce them too. The script was a pre-commit courtesy; a publish button
 * is a way to put unreviewed prose on the live site, so the same rules now sit
 * in the publish path where they cannot be forgotten.
 *
 * Pure by design: no Prisma import, no DB access, no `server-only`. It is
 * called from a tsx script and a server action alike; ViolationsPanel.tsx, a
 * client component, imports only the `Violation` type from here, not the
 * check functions.
 */
import type { Guide } from "@/content/guides/types";
import type { Post } from "@/content/posts/types";
import type { BrandId } from "@/brands/types";

export type Violation = {
  /** Which part of the article is at fault, for the editor's violations panel. */
  field: string;
  /** The offending text, or the measured value. */
  match: string;
  /** Why it is not publishable, in the author's language. */
  why: string;
};

export type Rule = { re: RegExp; why: string };

/**
 * Rule 1 - no therapeutic, medical or veterinary framing. "multi-dose" and
 * "for injection" are stripped by normalise() before scanning.
 */
export const MEDICAL_RULES: Rule[] = [
  { re: /\binject(?:s|ed|ing|ions?)\b/i, why: "instructs or describes administration" },
  { re: /\bdos(?:e|es|ing|age)\b/i, why: "dosing language" },
  { re: /\bpatients?\b/i, why: "clinical framing" },
  { re: /\byour body\b/i, why: "clinical framing" },
  { re: /\bmedication\b/i, why: "clinical framing" },
  { re: /\bHRT\b/, why: "clinical framing" },
  { re: /\bTRT\b/, why: "clinical framing" },
  { re: /\bpeptide therapy\b/i, why: "clinical framing" },
];

/**
 * Rule 2 - the preservative is never named or quantified anywhere. This one
 * is absolute: the chemical name trips advertising-platform review.
 */
export const PRESERVATIVE_RULES: Rule[] = [
  { re: /benzyl/i, why: "names the preservative" },
  { re: /\b100-51-6\b/, why: "CAS number of the preservative" },
  // Only a figure attached to the preservative itself. A percentage near the
  // word "preservative" is usually saline's 0.9% sodium chloride, which is a
  // different solute and legitimate to state.
  {
    re: /\d[\d.]*\s*(?:%|per cent|mg\/m[lL])\s*(?:w\/v\s*)?(?:of\s+)?(?:an?\s+)?(?:bacteriostatic\s+)?preservative/i,
    why: "quantifies the preservative",
  },
];

/** Rule 3 - price superlatives belong only on the home page, beside terms. */
export const PRICE_SUPERLATIVE_RULES: Rule[] = [
  { re: /\bcheapest\b/i, why: "price superlative" },
  { re: /\blowest price\b/i, why: "price superlative" },
  { re: /\bbest price\b/i, why: "price superlative" },
];

/** Rule 5 - UK English, no em dashes, no exclamation marks. */
export const HOUSE_STYLE_RULES: Rule[] = [
  { re: /—/, why: "em dash" },
  { re: /!/, why: "exclamation mark" },
];

/** BacLab's guides and posts: rules 1, 2, 3 and 5, in that order. */
export const BANNED: Rule[] = [...MEDICAL_RULES, ...PRESERVATIVE_RULES, ...PRICE_SUPERLATIVE_RULES, ...HOUSE_STYLE_RULES];

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

// ── Per-brand copy rules ────────────────────────────────────────────
// Every brand sells the same vial under the same law and to the same ad
// platforms, so every brand's copy is held to rules 1 and 2. On top of that
// each brand's voice has words of its own it must never use:
//  - BacLab: rules 3 and 5, its house style, exactly as for its guides;
//  - gym: the steroid vocabulary and the injection slang (the user allowed
//    "gear", "cycle", "blast" and "cruise", which are not banned);
//  - beauty: aesthetic procedures and treatment claims about skin;
//  - luxury: price-led words;
//  - wholesale: nothing beyond rules 1 and 2.
// checkBrandCopy is what `npm run check:brands` runs over brands/<id>/** and
// app/<id>/**, and what npm run test:kit runs over each brand's legal pages.

/**
 * Rule 1's injection words in every form, for the new brands. BacLab's
 * pattern needs a suffix ("injects", "injection"), and its guides may name
 * the US product, "Bacteriostatic Water for Injection", in the third person
 * (normalise). A new brand's copy has reason to do neither, so its sites are
 * held to the bare verb and the adjective too, with no exemption.
 */
const INJECTION_ANY_FORM: Rule = {
  re: /\binject(?:s|ed|ing|ion|ions|able|ables|or|ors)?\b/i,
  why: "injection framing",
};

/**
 * The gym brand. Steroids, the compounds by name and the injecting slang.
 *
 * "test" is the hard case: alone it is ordinary English ("a batch test",
 * "lab tested", "test results"), which a vial seller needs, so it is NOT
 * banned as a word. It is banned where it can only mean the compound:
 * testosterone in full; "test" joined to an ester or a form (test cyp,
 * test enanthate, test prop, Test E/C/P, test base, test susp); "test" after
 * the verbs of a cycle (on, running, blasting, cruising, pinning), unless a
 * noun follows that makes it ordinary ("on test results"); and "test" after
 * a quantity in mg. Tested, testing and every other ordinary use pass.
 *
 * "pin" bans the card PIN too, and "shot" a "product shot": the brand's copy
 * says "passcode" and "photo" instead. Better a false alarm a writer can see
 * than slang reaching an ad reviewer.
 */
export const GYM_RULES: Rule[] = [
  { re: /\bsteroid(?:s|al)?\b|\broids?\b/i, why: "names a controlled class of drug" },
  { re: /\banabolics?\b/i, why: "names a controlled class of drug" },
  { re: /\bPEDs?\b/i, why: "names performance-enhancing drugs" },
  { re: /\bperformance[- ]enhanc(?:ing|er|ers|ement)\b/i, why: "names performance-enhancing drugs" },
  { re: /\btren(?:bolone)?\b/i, why: "names a compound" },
  { re: /\btestosterone\b/i, why: "names a compound" },
  { re: /\btest[ -]?(?:cyp(?:ionate)?|enanthate|enan|prop(?:ionate)?|base|susp(?:ension)?)\b/i, why: "names a compound" },
  // The single-letter esters only in capitals: "test e" in lower case is
  // too often the start of "test e.g." to be worth the false alarm.
  { re: /\b[Tt]est[ -]?[ECP]\b/, why: "names a compound" },
  {
    re: /\b(?:on|running|blasting|cruising|pinning)\s+test\b(?!\s+(?:results?|certificates?|reports?|data|batch(?:es)?|orders?|vials?))/i,
    why: "names a compound",
  },
  { re: /\b\d+\s*mg\s+(?:of\s+)?test\b/i, why: "doses a compound" },
  { re: /\bdeca(?:[- ]durabolin)?\b/i, why: "names a compound" },
  { re: /\bd-?bol\b|\bdianabol\b/i, why: "names a compound" },
  { re: /\banavar\b/i, why: "names a compound" },
  { re: /\bwinstrol\b|\bwinn(?:y|ie)\b/i, why: "names a compound" },
  { re: /\bprimo(?:bolan)?\b/i, why: "names a compound" },
  { re: /\bh\.?g\.?h\b|\bgrowth hormone\b/i, why: "names a compound" },
  { re: /\bsarms?\b/i, why: "names a compound" },
  { re: /\bjuic(?:e|ed|er|ers|ing|y)\b/i, why: "slang for steroids" },
  { re: /\bpin(?:s|ned|ning)?\b/i, why: "slang for injecting" },
  { re: /\bjab(?:s|bed|bing)?\b/i, why: "slang for injecting" },
  { re: /\bshots?\b/i, why: "slang for injecting" },
  // Rule 1 already has dose, doses, dosing and dosage.
  { re: /\bdos(?:ed|ages)\b/i, why: "dosing language" },
];

/**
 * The beauty brand: never an aesthetic procedure, never a claim that the
 * product does anything for skin. Botox is a prescription-only medicine and
 * a trade mark. "Treat yourself" passes; "treatment" does not.
 */
export const BEAUTY_RULES: Rule[] = [
  { re: /\bbotox\b/i, why: "a prescription-only medicine, and a trade mark" },
  { re: /\bfillers?\b/i, why: "names a cosmetic procedure" },
  { re: /\b(?:neuro)?toxins?\b/i, why: "names a cosmetic procedure" },
  { re: /\binjectables?\b/i, why: "injection framing" },
  { re: /\banti[- ]?(?:wrinkles?|ageing|aging)\b/i, why: "a treatment claim about skin" },
  { re: /\bwrinkles?\b|\bfine lines\b|\bcrow'?s[- ]feet\b/i, why: "a treatment claim about skin" },
  { re: /\btreatments?\b|\bprocedures?\b/i, why: "treatment framing" },
  { re: /\brejuvenat\w*|\bcollagen\b|\bplump(?:s|ed|er|ing)?\b/i, why: "a treatment claim about skin" },
  { re: /\bheal(?:s|ed|ing)?\b|\bcur(?:e|es|ed|ing)\b/i, why: "a treatment claim" },
  {
    re: /\b(?:smooth|firm|plump|youthful|younger|radiant|glowing|renew|restor|brighten|tighten|lift)\w*\s+(?:(?:your|the)\s+)?skin\b/i,
    why: "a treatment claim about skin",
  },
  { re: /\bskin\s+(?:that\s+)?(?:looks?|feels?)\s+(?:younger|smoother|firmer|plumper|tighter)\b/i, why: "a treatment claim about skin" },
];

/** The luxury brand is never price-led. Its legal pages say "supply", never "sale". */
export const LUXURY_RULES: Rule[] = [
  { re: /\bcheap(?:er|est|ly)?\b/i, why: "price-led copy" },
  { re: /\bdiscount(?:s|ed|ing)?\b/i, why: "the brand never discounts" },
  { re: /\bsales?\b/i, why: "the brand holds no sales" },
];

const BRAND_LAYERS: Record<BrandId, Rule[]> = {
  baclab: [...PRICE_SUPERLATIVE_RULES, ...HOUSE_STYLE_RULES],
  beauty: BEAUTY_RULES,
  gym: GYM_RULES,
  wholesale: [],
  luxury: LUXURY_RULES,
};

/** Every rule a brand's copy is held to: rules 1 and 2, then its own. */
export function brandRules(id: BrandId): Rule[] {
  const layer = BRAND_LAYERS[id];
  if (!layer) throw new Error(`brandRules: no rules for brand "${id}"`);
  const shared = id === "baclab" ? [...MEDICAL_RULES, ...PRESERVATIVE_RULES] : [...MEDICAL_RULES, INJECTION_ANY_FORM, ...PRESERVATIVE_RULES];
  return [...shared, ...layer];
}

/**
 * The exemptions normalise() makes, per brand. BacLab keeps both. "Multi-
 * dose" stays the vial's own term on every other site but the gym's, which
 * bans every form of "dose"; "for injection" is exempt on BacLab's alone.
 */
function normaliseFor(id: BrandId, text: string): string {
  if (id === "baclab") return normalise(text);
  return id === "gym" ? text : text.replace(/multi[- ]dose/gi, "multientry");
}

/**
 * A brand's copy against its rules: every match, not just the first of each
 * rule, so a whole file can be fixed in one pass. `field` names where the
 * text came from (a file path, a page) for the report.
 */
export function checkBrandCopy(id: BrandId, text: string | readonly string[], field = "content"): Violation[] {
  const scan = normaliseFor(id, (typeof text === "string" ? [text] : text).join(DELIMITER));
  const out: Violation[] = [];
  const seen = new Set<string>();
  for (const { re, why } of brandRules(id)) {
    const all = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of scan.matchAll(all)) {
      const key = `${why}\u0000${m[0].toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ field, match: m[0], why });
    }
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
