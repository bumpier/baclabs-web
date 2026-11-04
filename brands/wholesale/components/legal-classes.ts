/**
 * The kit's legal page (components/commerce/LegalPage.tsx) in this brand's
 * hand: set like a supplier's printed conditions of sale, the title as
 * every page title, the contents in a mist box under the spec-sheet rule,
 * and the clauses separated by rules.
 */
export const LEGAL_CLASSES = {
  root: "",
  title: "vh-page-title",
  intro: "vh-page-lede",
  meta: "mt-3 text-sm text-ink-soft",
  toc: "vh-legal-toc mt-8",
  tocHeading: "text-sm font-bold text-spruce",
  tocList: "mt-3 list-decimal space-y-1.5 pl-5 text-sm md:columns-2 md:gap-10",
  sections: "mt-8",
  section: "scroll-mt-24 border-t border-line py-7",
  heading: "text-lg font-extrabold text-spruce",
  body: "legal-prose mt-3",
  foot: "mt-6 border-t-[3px] border-spruce pt-5 text-sm",
  link: "link",
};

/** The page around it. */
export const LEGAL_MAIN = "vh-page vh-wrap pt-6 md:pt-10";
export const LEGAL_SHEET = "vh-legal-sheet";
