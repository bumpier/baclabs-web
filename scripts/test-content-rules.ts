/**
 * Test suite for lib/content-rules.ts. Run with `npm run test:rules`.
 * Exits non-zero on the first failure, like scripts/check-guides.ts.
 *
 * This repo has no test runner and this file is not an argument for adding
 * one: the logic under test is pure, and a tsx script matches the pattern
 * already used by check-guides.ts.
 */
import {
  checkCompliance,
  checkGuideStructure,
  checkPostStructure,
  guideProse,
  normalise,
} from "@/lib/content-rules";
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
