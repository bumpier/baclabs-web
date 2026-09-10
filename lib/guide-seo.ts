import { brand } from "@/config/brand";
import { canonicalOrigin } from "@/lib/site-url";
import { GUIDE_AUTHOR } from "@/content/facts";
import type { Guide, GuideFaq } from "@/content/guides/types";
import type { Post } from "@/content/posts/types";

/**
 * Structured data for the guide and reference pages. Kept apart from
 * lib/seo.ts (breadcrumbs for the legal pages) so the two can be edited
 * independently; both return plain objects for <JsonLd>.
 */

function site(): string {
  return canonicalOrigin();
}

/**
 * Strips the two markup allowances from a string bound for structured data.
 *
 * Guide copy may carry `**bold**` and `[label](/path)`, which components
 * render through RichText. Schema values are consumed raw by search engines,
 * so the same string must reach them as plain prose - an `abstract` with
 * literal asterisks in it is the paragraph an answer engine would quote.
 * Stripping here means authors never have to remember which fields are safe
 * to emphasise.
 */
export function plainText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1");
}

function organization(): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: brand.company.legalName || brand.name,
    url: site(),
    logo: `${site()}/logo.svg`,
  };
}

/** FAQPage. Only pass questions whose answers are visible on the same page. */
export function faqPageSchema(items: readonly GuideFaq[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: plainText(f.a) },
    })),
  };
}

/** Article for one guide. The abstract is the quick answer, verbatim. */
export function guideArticleSchema(guide: Guide): Record<string, unknown> {
  const url = `${site()}/guides/${guide.slug}`;
  const author =
    GUIDE_AUTHOR.type === "Organization" ? organization() : { "@type": "Person", name: brand.name };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: guide.title,
    description: plainText(guide.description),
    abstract: plainText(guide.quickAnswer),
    url,
    mainEntityOfPage: url,
    inLanguage: "en-GB",
    dateModified: guide.updated,
    datePublished: guide.published ?? guide.updated,
    image: `${site()}/opengraph-image`,
    author,
    publisher: organization(),
    about: {
      "@type": "ChemicalSubstance",
      name: "Bacteriostatic water",
      alternateName: ["Bac water", "Bacteriostatic mixing water"],
    },
  };
}

/** Home → Guides → this guide. */
export function guideBreadcrumbSchema(guide: Guide): Record<string, unknown> {
  const s = site();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: brand.name, item: s },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${s}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title, item: `${s}/guides/${guide.slug}` },
    ],
  };
}

/** Home → this page, for the reference pages that sit beside the guides. */
export function pageBreadcrumbSchema(name: string, path: string): Record<string, unknown> {
  const s = site();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: brand.name, item: s },
      { "@type": "ListItem", position: 2, name, item: `${s}${path}` },
    ],
  };
}

/** The list of guides, for /guides. */
export function guideIndexSchema(guides: readonly Guide[]): Record<string, unknown> {
  const s = site();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Bacteriostatic water guides",
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `${s}/guides/${g.slug}`,
    })),
  };
}

/**
 * BlogPosting for one post. A post has no quick answer and no FAQ, so unlike
 * a guide it carries no `abstract` and no FAQPage beside it - but it must
 * still declare itself an article, which it previously did not.
 */
export function blogPostingSchema(post: Post): Record<string, unknown> {
  const url = `${site()}/blog/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    inLanguage: "en-GB",
    // Falls back to `updated` only when a draft is being previewed; a
    // published post always has a real, distinct first-publication date.
    datePublished: post.published ?? post.updated,
    dateModified: post.updated,
    image: `${site()}/opengraph-image`,
    author: organization(),
    publisher: organization(),
    isPartOf: { "@type": "Blog", "@id": `${site()}/blog#blog`, name: `${brand.name} blog` },
  };
}

/** The blog itself, for /blog. */
export function blogIndexSchema(posts: readonly Post[]): Record<string, unknown> {
  const s = site();
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${s}/blog#blog`,
    name: `${brand.name} blog`,
    url: `${s}/blog`,
    inLanguage: "en-GB",
    publisher: organization(),
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      "@id": `${s}/blog/${p.slug}#post`,
      headline: p.title,
      description: p.description,
      url: `${s}/blog/${p.slug}`,
      datePublished: p.published ?? p.updated,
      dateModified: p.updated,
    })),
  };
}
