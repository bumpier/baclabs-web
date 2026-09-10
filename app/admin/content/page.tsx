import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { createArticleAction } from "@/app/admin/content/actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requireAdminRole("ADMIN");

  const rows = await prisma.article.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      type: true,
      slug: true,
      title: true,
      status: true,
      updated: true,
      updatedAt: true,
    },
  });

  const newGuide = createArticleAction.bind(null, "GUIDE");
  const newPost = createArticleAction.bind(null, "POST");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink">Content</h1>
        <div className="flex gap-2">
          <form action={newGuide}>
            <button
              type="submit"
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white"
            >
              New guide
            </button>
          </form>
          <form action={newPost}>
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink"
            >
              New post
            </button>
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">Nothing here yet.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Address</th>
              <th className="py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="py-2 pr-4">
                  <Link href={`/admin/content/${r.id}`} className="font-medium text-ink underline">
                    {r.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-ink-soft">
                  {r.type === "GUIDE" ? "Guide" : "Post"}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={
                      r.status === "PUBLISHED"
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                        : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                    }
                  >
                    {r.status === "PUBLISHED" ? "Live" : "Draft"}
                  </span>
                </td>
                <td className="py-2 pr-4 text-ink-soft">
                  {r.status === "PUBLISHED" ? (
                    <Link
                      href={`${r.type === "GUIDE" ? "/guides" : "/blog"}/${r.slug}`}
                      className="underline"
                    >
                      /{r.type === "GUIDE" ? "guides" : "blog"}/{r.slug}
                    </Link>
                  ) : (
                    <span>/{r.slug}</span>
                  )}
                </td>
                <td className="py-2 text-ink-soft">{r.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
