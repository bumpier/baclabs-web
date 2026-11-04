/**
 * The kit's LegalPage slots in this brand's look (brands/gym/styles.css,
 * "The kit's legal page"), shared by the terms, privacy, returns and
 * disclaimer pages so the four never drift apart. The clause text keeps the
 * contract's .legal-prose spacing.
 */
export const LEGAL_CLASSES = {
  title: "gym-legal-title",
  intro: "gym-legal-intro",
  meta: "gym-legal-meta",
  toc: "gym-legal-toc",
  tocHeading: "gym-legal-toc-heading",
  tocList: "gym-legal-toc-list",
  sections: "mt-6",
  section: "gym-legal-section",
  heading: "gym-legal-heading",
  body: "legal-prose mt-4",
  foot: "gym-legal-foot",
  link: "gym-link",
} as const;
