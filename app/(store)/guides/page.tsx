import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { publishedGuides } from "@/lib/articles";
import { JsonLd } from "@/components/JsonLd";
import { guideIndexSchema, pageBreadcrumbSchema } from "@/lib/guide-seo";
import { BuyCard } from "@/components/guides/GuideArticle";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Bacteriostatic water guides",
  description: "Plain answers about bacteriostatic water: what it is, how it differs from sterile water and saline, how long it lasts once opened, how to store it, and where to buy it in the UK.",
  path: "/guides",
});

/** Reference pages that sit beside the guides. */
const TOOLS = [
  {
    href: "/calculator",
    title: "Dilution calculator",
    description: "Concentration from a vial's contents and the volume of diluent added, with worked examples.",
  },
  {
    href: "/safety-data-sheet",
    title: "Safety data sheet",
    description: "The 16-section SDS for bacteriostatic water.",
  },
  {
    href: "/faq",
    title: "All questions",
    description: "The full FAQ: the product, storage, ordering, delivery, wholesale and returns.",
  },
] as const;

export default async function GuidesIndexPage() {
  const guides = await publishedGuides();
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Guides", "/guides")} />
      <JsonLd data={guideIndexSchema(guides)} />
      <h1 className="text-3xl sm:text-4xl">Bacteriostatic water guides</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        One product, explained properly. Each guide opens with the direct answer and then works
        through the questions behind it.
      </p>

      <ul className="mt-10 grid gap-4">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="block rounded-panel border border-line bg-surface p-6 transition-colors duration-150 hover:border-brand/40"
            >
              <span className="block text-lg font-semibold text-ink">{g.title}</span>
              <span className="measure mt-1 block text-base text-ink-soft">{g.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-2xl">Reference</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="block h-full rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
            >
              <span className="block text-base font-semibold text-ink">{t.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">{t.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <BuyCard />
    </div>
  );
}
