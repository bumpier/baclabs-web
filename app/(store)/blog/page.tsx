import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { pageBreadcrumbSchema } from "@/lib/guide-seo";
import { BuyCard } from "@/components/guides/GuideArticle";
import { publishedPosts } from "@/lib/articles";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description:
    "Notes and updates from BacLab on bacteriostatic water, laboratory diluents, storage and handling.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const posts = await publishedPosts();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Blog", "/blog")} />
      <h1 className="text-3xl sm:text-4xl">Blog</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Notes and updates. For the reference material, see the{" "}
        <Link href="/guides" className="underline">
          guides
        </Link>
        .
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-base text-ink-soft">Nothing published yet.</p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="block rounded-panel border border-line bg-surface p-6 transition-colors duration-150 hover:border-brand/40"
              >
                <span className="block text-lg font-semibold text-ink">{p.title}</span>
                <span className="measure mt-1 block text-base text-ink-soft">{p.excerpt}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BuyCard />
    </div>
  );
}
