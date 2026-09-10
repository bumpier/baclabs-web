import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publishedGuideBySlug } from "@/lib/articles";
import { GuideArticle } from "@/components/guides/GuideArticle";

/**
 * Guides live in the database and are published from /admin, so they cannot
 * be enumerated at build time - see the DATABASE_URL placeholder in
 * Dockerfile:65. This route is ISR instead: a guide renders on the first
 * request and is served as cached static HTML after that.
 *
 * The hour is a backstop only. Publishing calls revalidatePath, so an edit is
 * live immediately; this catches a direct database edit or a revalidation
 * lost to a container restart.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await publishedGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.metaTitle,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.metaTitle,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      modifiedTime: guide.updated,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await publishedGuideBySlug(slug);
  if (!guide) notFound();

  // Related guides are resolved one query each. A guide has exactly two, and
  // the page is cached, so this is two extra reads per revalidation.
  const siblings = (await Promise.all(guide.related.map((s) => publishedGuideBySlug(s))))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
    .map((g) => ({ slug: g.slug, title: g.title, description: g.description }));

  return <GuideArticle guide={guide} siblings={siblings} />;
}
