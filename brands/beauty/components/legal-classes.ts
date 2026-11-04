/**
 * The kit's LegalPage, in this brand's type and layout. On a wide screen,
 * two columns: the contents on the left, held in view as you read, and the
 * clauses on the right at a reading measure; on a phone, the contents in a
 * blush panel above them. Headings in the display face, clause text in the
 * text face. Shared by the terms, privacy, returns and disclaimer pages.
 */
export const LEGAL_CLASSES = {
  root: "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-16",
  title: "au-display text-[clamp(2.5rem,1.9rem+2.4vw,4rem)] lg:col-start-2",
  intro: "au-lead mt-5 lg:col-start-2",
  meta: "au-small mt-4 lg:col-start-2",
  toc: "mt-10 rounded-[1.5rem] bg-blush p-6 lg:sticky lg:top-28 lg:col-start-1 lg:row-span-6 lg:row-start-1 lg:mt-2 lg:self-start lg:bg-transparent lg:p-0",
  tocHeading: "font-display text-[1.375rem]",
  tocList: "mt-3 list-decimal space-y-2 pl-5 text-[0.9375rem] text-ink-soft marker:text-ink-soft",
  sections: "mt-6 lg:col-start-2",
  section: "py-7",
  heading: "au-h3",
  body: "legal-prose mt-4",
  foot: "au-small mt-10 lg:col-start-2",
  link: "au-link",
} as const;
