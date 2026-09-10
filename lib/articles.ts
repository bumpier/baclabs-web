/**
 * The boundary between Article rows and the rest of the site.
 *
 * Nothing outside this file imports the Article type or queries the table.
 * Everything downstream consumes Guide and Post, which is why
 * components/guides/GuideArticle.tsx and lib/guide-seo.ts did not change when
 * guides moved into the database.
 */
import type { Article } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Guide, GuideFaq, GuideSection } from "@/content/guides/types";
import type { Post } from "@/content/posts/types";
import {
  type Violation,
  checkCompliance,
  checkGuideStructure,
  checkPostStructure,
  guideProse,
  postProse,
} from "@/lib/content-rules";

/**
 * A corrupt JSON column is a bug, not a content state, so it throws rather
 * than falling back to []. A guide silently rendering with no sections would
 * still emit Article schema and still be indexed - a loud 500 on one URL is
 * the better failure.
 */
function parseJson<T>(raw: string, slug: string, field: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Article "${slug}" has malformed JSON in ${field}`);
  }
}

export function toGuide(row: Article): Guide {
  return {
    slug: row.slug,
    title: row.title,
    metaTitle: row.metaTitle,
    description: row.description,
    quickAnswer: row.quickAnswer,
    updated: row.updated,
    sections: parseJson<GuideSection[]>(row.sections, row.slug, "sections"),
    faq: parseJson<GuideFaq[]>(row.faq, row.slug, "faq"),
    related: parseJson<string[]>(row.related, row.slug, "related"),
  };
}

export function toPost(row: Article): Post {
  return {
    slug: row.slug,
    title: row.title,
    metaTitle: row.metaTitle,
    description: row.description,
    excerpt: row.excerpt,
    markdown: row.markdown,
    updated: row.updated,
  };
}

/** Published guides in the curated teaching order, not by date. */
export async function publishedGuides(): Promise<Guide[]> {
  const rows = await prisma.article.findMany({
    where: { type: "GUIDE", status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toGuide);
}

export async function publishedGuideBySlug(slug: string): Promise<Guide | null> {
  const row = await prisma.article.findFirst({
    where: { slug, type: "GUIDE", status: "PUBLISHED" },
  });
  return row ? toGuide(row) : null;
}

/** For validating a guide's two `related` slugs. */
export async function publishedGuideSlugs(): Promise<Set<string>> {
  const rows = await prisma.article.findMany({
    where: { type: "GUIDE", status: "PUBLISHED" },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

/** Newest first - a blog reads in reverse chronological order. */
export async function publishedPosts(): Promise<Post[]> {
  const rows = await prisma.article.findMany({
    where: { type: "POST", status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toPost);
}

export async function publishedPostBySlug(slug: string): Promise<Post | null> {
  const row = await prisma.article.findFirst({
    where: { slug, type: "POST", status: "PUBLISHED" },
  });
  return row ? toPost(row) : null;
}

/**
 * Everything that blocks publishing this row. Empty means publishable.
 *
 * A guide's `related` slugs are checked against currently published guides,
 * excluding this row - so a guide cannot be published by pointing at itself,
 * and re-publishing an already-live guide does not fail on its own slug.
 */
export async function articleViolations(row: Article): Promise<Violation[]> {
  if (row.type === "POST") {
    const post = toPost(row);
    return [...checkCompliance(postProse(post)), ...checkPostStructure(post)];
  }
  const guide = toGuide(row);
  const slugs = await publishedGuideSlugs();
  slugs.delete(guide.slug);
  return [...checkCompliance(guideProse(guide)), ...checkGuideStructure(guide, slugs)];
}
