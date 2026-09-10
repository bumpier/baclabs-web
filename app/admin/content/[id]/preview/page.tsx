import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { publishedGuideBySlug, toGuide, toPost } from "@/lib/articles";
import { GuideArticle } from "@/components/guides/GuideArticle";
import { PostArticle } from "@/components/blog/PostArticle";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminRole("ADMIN");
  const { id } = await params;

  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) notFound();

  let body;
  if (row.type === "GUIDE") {
    const guide = toGuide(row);
    const siblings = (await Promise.all(guide.related.map((s) => publishedGuideBySlug(s))))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((g) => ({ slug: g.slug, title: g.title, description: g.description }));
    body = <GuideArticle guide={guide} siblings={siblings} />;
  } else {
    body = <PostArticle post={toPost(row)} />;
  }

  return (
    <div>
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        Preview of a {row.status === "PUBLISHED" ? "published" : "draft"} {row.type.toLowerCase()}.
        Not indexed, not public.{" "}
        <Link href={`/admin/content/${row.id}`} className="underline">
          Back to the editor
        </Link>
      </div>
      {body}
    </div>
  );
}
