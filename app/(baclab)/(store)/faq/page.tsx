import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { FAQ_ALL, FAQ_GROUPS } from "@/config/faq-full";
import { JsonLd } from "@/components/JsonLd";
import { FaqList } from "@/components/guides/FaqList";
import { BuyCard } from "@/components/guides/GuideArticle";
import { faqPageSchema, pageBreadcrumbSchema } from "@/lib/guide-seo";

export const dynamic = "force-static";

export const metadata: Metadata = pageMetadata({
  title: "Bacteriostatic water FAQ",
  description: "Every question we are asked about bacteriostatic water: what it is, storage and shelf life, ordering, delivery, bulk packs and returns. Straight answers.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("FAQ", "/faq")} />
      <JsonLd data={faqPageSchema(FAQ_ALL)} />

      <h1 className="text-3xl sm:text-4xl">Questions and answers</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Everything we are asked about the product and about ordering it, in one place. If yours is
        not here,{" "}
        <Link href="/contact" className="link">
          ask us
        </Link>
        .
      </p>

      <nav aria-label="Sections" className="mt-8 rounded-control border border-line p-5">
        <h2 className="text-sm font-semibold text-ink">On this page</h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {FAQ_GROUPS.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`} className="link">
                {g.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12 space-y-14">
        {FAQ_GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-24" aria-labelledby={`${g.id}-heading`}>
            <h2 id={`${g.id}-heading`} className="text-2xl">
              {g.title}
            </h2>
            <div className="mt-5">
              <FaqList items={g.items} openFirst={false} />
            </div>
          </section>
        ))}
      </div>

      <BuyCard />
    </div>
  );
}
