/**
 * The kit's LegalPage, in this brand's type: the title in the display face,
 * the contents in a porcelain panel, each clause's heading as a serif
 * heading. Shared by the terms, privacy, returns and disclaimer pages.
 */
export const LEGAL_CLASSES = {
  title: "au-display text-[clamp(2.5rem,1.9rem+2.4vw,3.75rem)]",
  intro: "au-lead mt-5",
  meta: "au-small mt-4",
  toc: "au-panel mt-10 p-6 sm:p-7",
  tocHeading: "font-semibold",
  tocList: "mt-3 list-decimal space-y-2 pl-5 text-[1rem]",
  sections: "mt-6",
  section: "scroll-mt-24 py-7",
  heading: "au-h3",
  body: "legal-prose mt-4",
  foot: "au-small mt-10",
  link: "au-link",
} as const;
