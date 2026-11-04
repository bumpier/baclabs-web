/**
 * The kit's LegalPage slots in this brand's look (brands/gym/styles.css,
 * "The kit's legal page"), shared by the terms, privacy, returns and
 * disclaimer pages so the four never drift apart. On a wide screen the
 * contents sit in a sticky column beside the clauses. The clause text keeps
 * the contract's .legal-prose spacing.
 */
export const LEGAL_CLASSES = {
  root: "gym-legal",
  title: "gym-legal-title",
  intro: "gym-legal-intro",
  meta: "gym-legal-meta",
  toc: "gym-legal-toc",
  tocHeading: "gym-legal-toc-heading",
  tocList: "gym-legal-toc-list",
  sections: "gym-legal-sections",
  section: "gym-legal-section",
  heading: "gym-legal-heading",
  body: "legal-prose mt-4",
  foot: "gym-legal-foot",
  link: "gym-link",
} as const;
