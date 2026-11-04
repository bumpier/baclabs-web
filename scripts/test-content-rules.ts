/**
 * Test suite for lib/content-rules.ts. Run with `npm run test:rules`.
 * Exits non-zero on the first failure, like scripts/check-guides.ts.
 *
 * This repo has no test runner and this file is not an argument for adding
 * one: the logic under test is pure, and a tsx script matches the pattern
 * already used by check-guides.ts.
 */
import {
  BANNED,
  brandRules,
  checkBrandCopy,
  checkCompliance,
  checkGuideStructure,
  checkPostStructure,
  guideProse,
  normalise,
} from "@/lib/content-rules";
import { BRAND_IDS, type BrandId } from "@/brands/types";
import type { Guide } from "@/content/guides/types";
import type { Post } from "@/content/posts/types";
import { GUIDES } from "@/content/guides";
import { toGuide, toPost } from "@/lib/articles";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

/** A structurally valid guide, used as the base for targeted mutations. */
function validGuide(over: Partial<Guide> = {}): Guide {
  return {
    slug: "test-guide",
    title: "Test guide",
    metaTitle: "Bacteriostatic water test guide",
    description: "A structurally valid guide used by the rule tests.",
    quickAnswer: Array.from({ length: 50 }, () => "word").join(" "),
    updated: "2026-09-10",
    sections: Array.from({ length: 5 }, (_, i) => ({
      heading: `Heading ${i}`,
      paragraphs: ["A plain paragraph."],
    })),
    faq: Array.from({ length: 4 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` })),
    related: ["other-a", "other-b"],
    ...over,
  };
}

const OTHERS = new Set(["test-guide", "other-a", "other-b"]);

// ── Compliance: every banned pattern is caught ──────────────────────────
const MUST_CATCH: [string, string][] = [
  ["injecting", "You are injecting the solution."],
  ["dose", "Measure the dose carefully."],
  ["patients", "Given to patients on a ward."],
  ["your body", "It travels through your body."],
  ["medication", "Store the medication safely."],
  ["HRT", "Used alongside HRT."],
  ["TRT", "Used alongside TRT."],
  ["peptide therapy", "Common in peptide therapy."],
  ["benzyl", "It contains benzyl alcohol."],
  ["CAS", "The preservative is 100-51-6."],
  ["quantified", "It holds 0.9% w/v preservative."],
  ["cheapest", "We are the cheapest in the UK."],
  ["lowest price", "Ours is the lowest price online."],
  ["best price", "That is the best price around."],
  ["em dash", "Sterile water — without preservative."],
  ["exclamation", "Order today!"],
];

for (const [label, text] of MUST_CATCH) {
  check(`catches ${label}`, checkCompliance([text]).length > 0, JSON.stringify(text));
}

// ── Compliance: permitted vocabulary survives ───────────────────────────
check("permits multi-dose", checkCompliance(["This is a multi-dose vial."]).length === 0);
check(
  "permits the USP product name",
  checkCompliance(["Sold in the US as Bacteriostatic Water for Injection, USP."]).length === 0
);
check("normalise rewrites multi-dose", !/multi-dose/i.test(normalise("A multi-dose vial")));
check(
  "normalise rewrites for injection",
  !/for injection/i.test(normalise("Bacteriostatic Water for Injection"))
);

// ── The join delimiter prevents a cross-string false positive ───────────
check(
  "does not match a quantified preservative across two strings",
  checkCompliance(["Sodium chloride 0.9% w/v", "Preservative"]).length === 0,
  "the ¦ delimiter is missing or was replaced by whitespace"
);

// ── Per-brand rules (brandRules / checkBrandCopy) ───────────────────────
const NEW_BRANDS = BRAND_IDS.filter((id) => id !== "baclab");
const caught = (id: BrandId, text: string) => checkBrandCopy(id, text).length > 0;

// BacLab's layer is exactly its guide rules, in the same order.
check(
  "BacLab's brand rules are its guide rules",
  JSON.stringify(brandRules("baclab").map((r) => [r.re.source, r.re.flags, r.why])) ===
    JSON.stringify(BANNED.map((r) => [r.re.source, r.re.flags, r.why]))
);
for (const id of BRAND_IDS) check(`${id} has rules`, brandRules(id).length > 0);

// Rules 1 and 2 hold for every brand.
const EVERY_BRAND_CATCHES = [
  "Measure the dose carefully.",
  "Given to patients on a ward.",
  "It contains benzyl alcohol.",
  "It holds 0.9% w/v preservative.",
  "You are injecting the solution.",
];
for (const id of BRAND_IDS) {
  for (const text of EVERY_BRAND_CATCHES) check(`${id} catches ${JSON.stringify(text)}`, caught(id, text));
}
// The new brands get every form of "inject", and no USP-name exemption.
for (const id of NEW_BRANDS) {
  for (const text of ["Inject it slowly.", "An injectable vial.", "Bacteriostatic Water for Injection, USP."]) {
    check(`${id} catches ${JSON.stringify(text)}`, caught(id, text));
  }
}
check("BacLab keeps the USP-name exemption", !caught("baclab", "Sold in the US as Bacteriostatic Water for Injection, USP."));
check("multi-dose passes on beauty", !caught("beauty", "A sealed multi-dose vial."));
check("multi-dose is caught on gym", caught("gym", "A sealed multi-dose vial."));

// BacLab only: the price superlative and house style.
check("BacLab catches the superlative", caught("baclab", "We are the cheapest in the UK."));
check("BacLab catches an em dash", caught("baclab", "Sterile water — sealed."));
check("BacLab catches an exclamation", caught("baclab", "Order today!"));
for (const id of ["gym", "wholesale", "beauty"] as const) {
  check(`${id} allows an exclamation`, !caught(id, "Order today!"));
}

const GYM_CATCHES = [
  "Steroids are not sold here.",
  "anabolic",
  "No PEDs.",
  "performance enhancing",
  "performance-enhancing",
  "tren",
  "trenbolone",
  "testosterone",
  "Test E",
  "test-C",
  "test cyp",
  "test enanthate",
  "test prop",
  "running test",
  "on test",
  "250mg test",
  "deca",
  "dbol",
  "d-bol",
  "anavar",
  "winstrol",
  "winny",
  "primo",
  "HGH",
  "SARMs",
  "juice",
  "juiced",
  "pin",
  "pinning",
  "jab",
  "a shot",
  "shots",
  "dose",
  "dosed",
  "inject",
];
for (const text of GYM_CATCHES) check(`gym catches ${JSON.stringify(text)}`, caught("gym", text));
const GYM_ALLOWS = [
  "Stock up before your next cycle.",
  "Gear up.",
  "Blast and cruise.",
  "Every batch is tested.",
  "Lab tested, batch test certificate on request.",
  "Our test results are published.",
  "A test order of 5 vials.",
  "Testing every batch.",
  "The latest trend.",
  "A decade of supply.",
  "Screenshot your receipt.",
  "Spin up a fresh order.",
  "Juniper.",
  "Primary packaging.",
  "Speedy delivery.",
];
for (const text of GYM_ALLOWS) check(`gym allows ${JSON.stringify(text)}`, !caught("gym", text), JSON.stringify(checkBrandCopy("gym", text)));

const BEAUTY_CATCHES = [
  "Botox",
  "dermal filler",
  "fillers",
  "toxin",
  "neurotoxins",
  "injectables",
  "anti-wrinkle",
  "anti-ageing",
  "fewer wrinkles",
  "fine lines",
  "a treatment",
  "the procedure",
  "rejuvenating",
  "collagen",
  "plumping",
  "heals",
  "cures",
  "smoother skin",
  "skin that looks younger",
  "brightens your skin",
];
for (const text of BEAUTY_CATCHES) check(`beauty catches ${JSON.stringify(text)}`, caught("beauty", text));
const BEAUTY_ALLOWS = [
  "Treat yourself.",
  "Your ritual, done properly.",
  "Our health and safety data.",
  "A secure checkout.",
  "No therapeutic or curative claim.",
  "For clinics and salons.",
  "Detox your shelf.",
];
for (const text of BEAUTY_ALLOWS) check(`beauty allows ${JSON.stringify(text)}`, !caught("beauty", text), JSON.stringify(checkBrandCopy("beauty", text)));

for (const text of ["cheap", "cheaper", "a discount", "discounted", "the sale", "Winter sales"]) {
  check(`luxury catches ${JSON.stringify(text)}`, caught("luxury", text));
}
for (const text of ["Not for resale.", "Sold as a laboratory reagent.", "Considered, never rushed."]) {
  check(`luxury allows ${JSON.stringify(text)}`, !caught("luxury", text));
}

// Wholesale: rules 1 and 2 only.
for (const text of ["Cheapest per vial.", "Bulk discount.", "Trade sale.", "50 test vials.", "A treatment room."]) {
  check(`wholesale allows ${JSON.stringify(text)}`, !caught("wholesale", text));
}

// Every match, not just the first of each rule; the same word twice is reported once.
const many = checkBrandCopy("gym", ["juice and more juice", "pin it, jab it"], "copy.ts");
check("reports every match", many.length === 3, JSON.stringify(many));
check("names the field", many.every((v) => v.field === "copy.ts"));
check("no cross-string match", checkBrandCopy("gym", ["Sodium chloride 0.9% w/v", "Preservative"]).length === 0);

let unknownThrew = false;
try {
  brandRules("nope" as BrandId);
} catch {
  unknownThrew = true;
}
check("an unknown brand has no rules to fall back on", unknownThrew);

// ── Structure: guides ───────────────────────────────────────────────────
check("accepts a valid guide", checkGuideStructure(validGuide(), OTHERS).length === 0);
check(
  "rejects a metaTitle over 60 chars",
  checkGuideStructure(validGuide({ metaTitle: `Bacteriostatic water ${"x".repeat(60)}` }), OTHERS).length > 0
);
check(
  "rejects a metaTitle without the phrase",
  checkGuideStructure(validGuide({ metaTitle: "Something else entirely" }), OTHERS).length > 0
);
check(
  "rejects a description over 155 chars",
  checkGuideStructure(validGuide({ description: "y".repeat(156) }), OTHERS).length > 0
);
check(
  "rejects a 39-word quickAnswer",
  checkGuideStructure(
    validGuide({ quickAnswer: Array.from({ length: 39 }, () => "word").join(" ") }),
    OTHERS
  ).length > 0
);
check(
  "accepts a 75-word quickAnswer",
  checkGuideStructure(
    validGuide({ quickAnswer: Array.from({ length: 75 }, () => "word").join(" ") }),
    OTHERS
  ).length === 0,
  "the enforced range is 40-75, not 40-60 - see Task 1 Step 1"
);
check(
  "rejects a 76-word quickAnswer",
  checkGuideStructure(
    validGuide({ quickAnswer: Array.from({ length: 76 }, () => "word").join(" ") }),
    OTHERS
  ).length > 0
);
check(
  "rejects 4 sections",
  checkGuideStructure(validGuide({ sections: validGuide().sections.slice(0, 4) }), OTHERS).length > 0
);
check(
  "rejects 3 faq entries",
  checkGuideStructure(validGuide({ faq: validGuide().faq.slice(0, 3) }), OTHERS).length > 0
);
check(
  "rejects 1 related slug",
  checkGuideStructure(validGuide({ related: ["other-a"] }), OTHERS).length > 0
);
check(
  "rejects an unknown related slug",
  checkGuideStructure(validGuide({ related: ["other-a", "nope"] }), OTHERS).length > 0
);
check(
  "rejects relating to itself",
  checkGuideStructure(validGuide({ related: ["test-guide", "other-a"] }), OTHERS).length > 0
);
check(
  "rejects a malformed updated date",
  checkGuideStructure(validGuide({ updated: "10-09-2026" }), OTHERS).length > 0
);

// ── Structure: posts are exempt from the guide-only rules ───────────────
const validPost: Post = {
  slug: "test-post",
  title: "Test post",
  metaTitle: "A test post",
  description: "A valid post.",
  excerpt: "A valid post.",
  markdown: "## Heading\n\nA paragraph.",
  updated: "2026-09-10",
};

check("accepts a valid post", checkPostStructure(validPost).length === 0);
check(
  "rejects an empty post body",
  checkPostStructure({ ...validPost, markdown: "   " }).length > 0
);
check(
  "rejects a post metaTitle over 60 chars",
  checkPostStructure({ ...validPost, metaTitle: "z".repeat(61) }).length > 0
);
check(
  "does not apply guide structure rules to posts",
  checkPostStructure({ ...validPost, markdown: "One short line." }).length === 0
);

// ── The 13 shipped guides still pass ────────────────────────────────────
const shippedSlugs = new Set(GUIDES.map((g) => g.slug));
for (const g of GUIDES) {
  const v = [...checkCompliance(guideProse(g)), ...checkGuideStructure(g, shippedSlugs)];
  check(`shipped guide ${g.slug} passes`, v.length === 0, v.map((x) => x.why).join("; "));
}

// ── Mappers: a row becomes a render contract ────────────────────────────
const guideRow = {
  id: "a1",
  type: "GUIDE",
  slug: "row-guide",
  status: "PUBLISHED",
  title: "Row guide",
  metaTitle: "Bacteriostatic water row guide",
  description: "From a row.",
  updated: "2026-09-10",
  quickAnswer: "Short answer.",
  sections: JSON.stringify([{ heading: "H", paragraphs: ["P"] }]),
  faq: JSON.stringify([{ q: "Q", a: "A" }]),
  related: JSON.stringify(["a", "b"]),
  markdown: "",
  excerpt: "",
  sortOrder: 0,
  authorId: null,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mappedGuide = toGuide(guideRow as never);
check("toGuide parses sections", mappedGuide.sections[0]?.heading === "H");
check("toGuide parses faq", mappedGuide.faq[0]?.q === "Q");
check("toGuide parses related", mappedGuide.related.length === 2);
check("toGuide keeps updated as a string", mappedGuide.updated === "2026-09-10");

const mappedPost = toPost({ ...guideRow, type: "POST", markdown: "# Hi", excerpt: "E" } as never);
check("toPost carries markdown", mappedPost.markdown === "# Hi");
check("toPost carries excerpt", mappedPost.excerpt === "E");

check("toGuide maps publishedAt to a YYYY-MM-DD published date", /^\d{4}-\d{2}-\d{2}$/.test(mappedGuide.published ?? ""));
check("toPost maps publishedAt to a YYYY-MM-DD published date", /^\d{4}-\d{2}-\d{2}$/.test(mappedPost.published ?? ""));
check(
  "a row with no publishedAt yields undefined, not a bogus date",
  toGuide({ ...guideRow, publishedAt: null } as never).published === undefined
);

let threw = false;
try {
  toGuide({ ...guideRow, sections: "{not json" } as never);
} catch {
  threw = true;
}
check("toGuide throws on corrupt JSON rather than rendering an empty guide", threw);

if (failures) {
  console.error(`\n${failures} test failure(s).`);
  process.exit(1);
}
console.log("✓ content rules pass every test");
