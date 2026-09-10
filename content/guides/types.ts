/**
 * The shape of one guide. Plain data, no JSX, so a guide can be authored,
 * reviewed and diffed as text — and so every guide is rendered by exactly one
 * component (components/guides/GuideArticle.tsx) and carries the same
 * schema, the same quick-answer block and the same links to the product.
 */
export interface GuideTable {
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface GuideSection {
  /** Rendered as an H2. Phrase it as the sub-question it answers. */
  heading: string;
  /** Plain paragraphs. No markup; a `**bold**` run is the one exception. */
  paragraphs: string[];
  /** Optional bullet list, rendered after the paragraphs. */
  list?: string[];
  /** Optional table, rendered after the list. */
  table?: GuideTable;
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  /** URL segment under /guides/. */
  slug: string;
  /** H1, and the name in the breadcrumb. */
  title: string;
  /** <title>. Under ~60 characters; the brand is appended by the layout. */
  metaTitle: string;
  /** Meta description. Under ~155 characters. */
  description: string;
  /**
   * The direct answer, 40–60 words, rendered first and marked up as the
   * article's abstract. This is the paragraph an answer engine lifts.
   */
  quickAnswer: string;
  /** ISO date, YYYY-MM-DD. Bump when the wording changes. */
  updated: string;
  /**
   * ISO date, YYYY-MM-DD, of first publication. Optional: the TypeScript
   * guide modules predate it, and a draft has not been published at all.
   * Schema falls back to `updated` when it is absent, rather than claiming
   * a publication date the site cannot substantiate.
   */
  published?: string;
  sections: GuideSection[];
  faq: GuideFaq[];
  /** Slugs of two sibling guides to link at the end. */
  related: string[];
}
