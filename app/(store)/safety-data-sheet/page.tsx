import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { brand } from "@/config/brand";
import { PRODUCT, VIAL_ML } from "@/config/funnel";
import { FACTS } from "@/content/facts";
import { SDS_REVISION, SDS_SECTIONS, SDS_VERSION } from "@/content/sds";
import { canonicalOrigin } from "@/lib/site-url";
import { JsonLd } from "@/components/JsonLd";
import { PrintButton } from "@/components/PrintButton";
import { BuyCard } from "@/components/guides/GuideArticle";
import { pageBreadcrumbSchema } from "@/lib/guide-seo";

export const dynamic = "force-static";

const DESCRIPTION =
  "Sixteen-section safety data sheet for bacteriostatic water, sterile water with a bacteriostatic preservative. Hazard classification, composition, handling, storage, disposal and transport.";

export const metadata: Metadata = pageMetadata({
  title: "Bacteriostatic water safety data sheet (SDS)",
  description: DESCRIPTION,
  path: "/safety-data-sheet",
});

export default function SafetyDataSheetPage() {
  const site = canonicalOrigin();
  const url = `${site}/safety-data-sheet`;
  const org = { "@type": "Organization", name: brand.company.legalName || brand.name, url: site };

  const substanceSchema = {
    "@context": "https://schema.org",
    "@type": "ChemicalSubstance",
    "@id": `${url}#substance`,
    name: PRODUCT.name,
    alternateName: [...FACTS.synonyms],
    description: PRODUCT.composition,
    chemicalComposition: `Water (CAS ${FACTS.casWater}) with a bacteriostatic preservative`,
    potentialUse: "Laboratory and research diluent",
    safetyConsideration: FACTS.hazardClassification,
    url,
  };
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${PRODUCT.name} safety data sheet`,
    description: DESCRIPTION,
    url,
    mainEntityOfPage: url,
    inLanguage: "en-GB",
    dateModified: SDS_REVISION,
    version: SDS_VERSION,
    author: org,
    publisher: org,
    about: { "@id": `${url}#substance` },
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Safety data sheet", "/safety-data-sheet")} />
      <JsonLd data={substanceSchema} />
      <JsonLd data={articleSchema} />

      <nav aria-label="Breadcrumb" className="no-print text-sm text-ink-soft">
        <Link href="/guides" className="link">
          Guides
        </Link>
      </nav>
      <h1 className="mt-4 text-3xl sm:text-4xl">Safety data sheet</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        {PRODUCT.name}, {VIAL_ML} mL. {PRODUCT.composition} Sixteen sections in the UK REACH
        format. Revision {SDS_VERSION}, {SDS_REVISION}.
      </p>
      <div className="no-print mt-5">
        <PrintButton label="Print this sheet" />
      </div>

      <nav aria-label="Sections" className="no-print mt-8 rounded-control border border-line p-5">
        <h2 className="text-sm font-semibold text-ink">Sections</h2>
        <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {SDS_SECTIONS.map((s, i) => (
            <li key={s.heading} className="flex gap-2">
              <span className="tabular text-ink-soft">{i + 1}.</span>
              <a href={`#section-${i + 1}`} className="link">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {SDS_SECTIONS.map((s, i) => (
          <section key={s.heading} id={`section-${i + 1}`} className="scroll-mt-24 py-8">
            <h2 className="text-lg">
              <span className="tabular mr-2 text-ink-soft">{i + 1}.</span>
              {s.heading}
            </h2>
            {s.paragraphs?.map((p, j) => (
              <p key={j} className="measure mt-3 text-sm text-ink-soft">
                {p}
              </p>
            ))}
            {s.rows ? (
              <dl className="mt-4 divide-y divide-line/70 text-sm">
                {s.rows.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
                    <dt className="font-medium text-ink">{k}</dt>
                    <dd className="text-ink-soft">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {s.list ? (
              <ul className="mt-4 list-disc pl-5 text-sm text-ink-soft marker:text-ink-soft/50">
                {s.list.map((li, j) => (
                  <li key={j} className="mt-2 first:mt-0">
                    {li}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <div className="no-print">
        <BuyCard />
      </div>
    </div>
  );
}
