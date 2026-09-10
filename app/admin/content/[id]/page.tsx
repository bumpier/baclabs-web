import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { articleViolations, publishedGuideSlugs, toGuide, toPost } from "@/lib/articles";
import { GuideForm } from "@/app/admin/content/[id]/GuideForm";
import { PostForm } from "@/app/admin/content/[id]/PostForm";
import { ViolationsPanel } from "@/app/admin/content/[id]/ViolationsPanel";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole("ADMIN");
  const { id } = await params;

  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) notFound();

  // Computed from the SAVED row, so the panel and the publish action can
  // never disagree about what is wrong.
  const violations = await articleViolations(row);

  const slugs = await publishedGuideSlugs();
  slugs.delete(row.slug);
  const relatedOptions = [...slugs].sort();

  const isLive = row.status === "PUBLISHED";
  const publicHref = `${row.type === "GUIDE" ? "/guides" : "/blog"}/${row.slug}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/content" className="text-sm text-ink-soft underline">
            Back to content
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {row.type === "GUIDE" ? "Guide" : "Post"}: {row.title}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/admin/content/${row.id}/preview`} className="underline">
            Preview
          </Link>
          {isLive ? (
            <Link href={publicHref} className="underline">
              View live
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <ViolationsPanel violations={violations} />
      </div>

      <div className="mt-6">
        {row.type === "GUIDE" ? (
          <GuideForm
            id={row.id}
            guide={toGuide(row)}
            sortOrder={row.sortOrder}
            slugLocked={row.publishedAt !== null}
            isLive={isLive}
            canPublish={violations.length === 0}
            relatedOptions={relatedOptions}
          />
        ) : (
          <PostForm
            id={row.id}
            post={toPost(row)}
            slugLocked={row.publishedAt !== null}
            isLive={isLive}
            canPublish={violations.length === 0}
          />
        )}
      </div>
    </div>
  );
}
