/**
 * The shape of one blog post. Looser than `Guide`: a post is prose, not a
 * structured answer, so it carries no quickAnswer, no sections and no FAQ.
 * Rendered by components/blog/PostArticle.tsx.
 */
export interface Post {
  /** URL segment under /blog/. */
  slug: string;
  /** H1, and the name in the breadcrumb. */
  title: string;
  /** <title>. Under ~60 characters. */
  metaTitle: string;
  /** Meta description. Under ~155 characters. */
  description: string;
  /** One or two sentences shown on the blog index. */
  excerpt: string;
  /** The body, as markdown. */
  markdown: string;
  /** ISO date, YYYY-MM-DD. */
  updated: string;
  /**
   * ISO date, YYYY-MM-DD, of first publication. Optional: the TypeScript
   * guide modules predate it, and a draft has not been published at all.
   * Schema falls back to `updated` when it is absent, rather than claiming
   * a publication date the site cannot substantiate.
   */
  published?: string;
}
