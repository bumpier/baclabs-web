/**
 * The kit's legal page (components/commerce/LegalPage.tsx) in this brand's
 * hand: set on one white sheet, the title expanded like every page title,
 * the contents as a ruled box, and the clauses separated by rules, the way
 * a printed set of conditions of sale reads.
 */
export const LEGAL_CLASSES = {
  root: "",
  title: "wh-page-title",
  intro: "wh-page-lede",
  meta: "mt-3 text-sm text-ink-soft",
  toc: "wh-legal-toc mt-8",
  tocHeading: "text-sm font-bold text-steel",
  tocList: "mt-3 list-decimal space-y-1.5 pl-5 text-sm md:columns-2 md:gap-10",
  sections: "mt-8",
  section: "scroll-mt-6 border-t border-line py-7",
  heading: "text-lg font-bold text-navy [font-stretch:112%]",
  body: "legal-prose mt-3",
  foot: "mt-6 border-t-2 border-steel pt-5 text-sm",
  link: "link",
};

/** The page around it: the sheet on the slate ground. */
export const LEGAL_MAIN = "wh-wrap py-6 md:py-12";
export const LEGAL_SHEET = "wh-sheet wh-legal-sheet mx-auto max-w-4xl px-4 py-7 md:px-12 md:py-12";
