import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT, VIAL_ML } from "@/config/funnel";
import { BATCH_DOCUMENTS, MANUFACTURER } from "@/config/documentation";
import { FACTS } from "@/content/facts";
import { SDS_REVISION, SDS_VERSION } from "@/content/sds";
import { JsonLd } from "@/components/JsonLd";
import { pageBreadcrumbSchema } from "@/lib/guide-seo";
import { pageMetadata } from "@/lib/seo";
import { BuyCard } from "@/components/guides/GuideArticle";

export const dynamic = "force-static";

/**
 * Quality and documentation.
 *
 * This page owns the "certificate of analysis" and "specification" cluster.
 * The hard rule it is built around: it explains what documentation RECORDS
 * and how to read it, and it publishes what actually exists for this
 * product. It never implies a document is available when it is not.
 *
 * `BATCH_DOCUMENTS` ships empty, so the batch section renders nothing at all
 * until a real, batch-linked file is added to config/documentation.ts. The
 * rest of the page stands on facts already confirmed from the label and the
 * safety data sheet.
 */

/** Specification rows. Any row whose value is empty is dropped, not guessed. */
const SPECIFICATION: readonly { label: string; value: string }[] = [
  { label: "Product", value: `${PRODUCT.name}, ${PRODUCT.size}` },
  { label: "Composition", value: PRODUCT.composition },
  { label: "Appearance", value: FACTS.appearance },
  { label: "Fill volume", value: `${VIAL_ML}ml` },
  { label: "CAS number (water)", value: FACTS.casWater },
  { label: "EC number (water)", value: FACTS.ecWater },
  { label: "Molecular formula (water)", value: FACTS.formulaWater },
  { label: "Molecular weight (water)", value: `${FACTS.molecularWeightWater} g/mol` },
  { label: "pH", value: PRODUCT.ph },
  { label: "Storage", value: PRODUCT.storage },
  { label: "Shelf life, unopened", value: PRODUCT.shelfLifeUnopened },
  { label: "In-use limit once opened", value: PRODUCT.shelfLifeAfterOpening },
  { label: "Hazard classification", value: FACTS.hazardClassification },
  { label: "Country of origin", value: PRODUCT.origin },
].filter((r) => r.value);

/** What each test on a certificate of analysis actually demonstrates. */
const TESTS: readonly { name: string; what: string; limit: string }[] = [
  {
    name: "Appearance",
    what: "A visual check against a stated description, under defined lighting.",
    limit:
      "It detects gross contamination, particulates and discolouration. It says nothing about sterility or about anything dissolved in the water.",
  },
  {
    name: "pH",
    what: "The acidity of the solution, measured with a calibrated meter.",
    limit:
      "It confirms the solution sits in its specified range. It is a property of the batch as tested, not a guarantee of compatibility with anything you add to it.",
  },
  {
    name: "Sterility",
    what:
      "A culture-based test showing no microbial growth in the sample under the conditions of the method.",
    limit:
      "It applies to the sealed vial as manufactured. Once the stopper is punctured the result no longer describes the contents — that is what the in-use limit exists for.",
  },
  {
    name: "Preservative content",
    what: "An assay confirming the bacteriostatic preservative is present at the specified level.",
    limit:
      "It shows the preservative is within specification for that batch. It does not extend the in-use limit or make the vial suitable for any use beyond the one it is sold for.",
  },
  {
    name: "Container closure integrity",
    what: "A check that the seal holds, so the sealed contents stay sealed.",
    limit:
      "It describes the container as tested. A vial that arrives with a damaged seal or a lifted cap should not be used regardless of what the batch record says.",
  },
];

export const metadata: Metadata = pageMetadata({
  title: "Quality and documentation",
  description:
    "The specification for our 10ml bacteriostatic water, what a certificate of analysis records, what each test does and does not demonstrate, and the documentation published for this product.",
  path: "/quality-and-documentation",
});

export default function QualityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Quality and documentation", "/quality-and-documentation")} />

      <h1 className="text-3xl sm:text-4xl">Quality and documentation</h1>
      <p className="measure mt-4 text-lg text-ink-soft">
        What is published for this product, what a certificate of analysis actually records, and
        what each test on one does and does not demonstrate. Read it before you ask a supplier for
        paperwork, so you know what to ask for.
      </p>

      <h2 className="mt-14 text-2xl">Specification</h2>
      <p className="measure mt-3 text-base text-ink-soft">
        The confirmed properties of the product as sold. A property that is batch-specific, or that
        we have not confirmed from the label or the supplier&rsquo;s specification, is left out
        rather than estimated.
      </p>
      <div className="mt-5 overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Specification for {PRODUCT.name.toLowerCase()}, {PRODUCT.size}
          </caption>
          <tbody>
            {SPECIFICATION.map((r) => (
              <tr key={r.label} className="align-top">
                <th
                  scope="row"
                  className="w-[16rem] border-b border-line px-4 py-3 font-medium text-ink"
                >
                  {r.label}
                </th>
                <td className="border-b border-line px-4 py-3 text-ink-soft">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="measure mt-4 text-sm text-ink-soft">
        The unopened expiry is batch-specific and printed on the vial, so it is not stated here as a
        single figure. Read it from the label of the vial you have.
      </p>

      <h2 className="mt-14 text-2xl">How to read a certificate of analysis</h2>
      <p className="measure mt-3 text-base text-ink-soft">
        A certificate of analysis records what was measured on one specific batch, by whom, against
        which limits. Three things make one useful: a batch identifier you can match to the vial in
        your hand, a date, and stated limits rather than the word &ldquo;pass&rdquo; on its own. A
        document with none of those describes nothing you can check.
      </p>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        {TESTS.map((t) => (
          <div key={t.name} className="py-5">
            <dt className="text-base font-semibold text-ink">{t.name}</dt>
            <dd className="measure mt-1.5 text-base text-ink-soft">
              {t.what} <span className="text-ink">What it does not show:</span> {t.limit}
            </dd>
          </div>
        ))}
      </dl>

      {/* Renders only when a real, batch-linked document exists. See the note
          at the top of config/documentation.ts — an empty list must produce no
          section at all, never a "coming soon" or an implied availability. */}
      {BATCH_DOCUMENTS.length > 0 ? (
        <>
          <h2 className="mt-14 text-2xl">Batch documents</h2>
          <p className="measure mt-3 text-base text-ink-soft">
            Each document below is tied to a batch identifier printed on the vial label. Match the
            batch on your vial to the batch on the document.
          </p>
          <ul className="mt-5 grid gap-4">
            {BATCH_DOCUMENTS.map((d) => (
              <li key={`${d.batch}-${d.kind}`}>
                <a
                  href={d.href}
                  className="block rounded-panel border border-line bg-surface p-5 transition-colors duration-150 hover:border-brand/40"
                >
                  <span className="block text-base font-semibold text-ink">
                    {d.kind} &mdash; batch {d.batch}
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    Document dated {d.documentDate}
                    {d.expiry ? ` · batch expiry ${d.expiry}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {MANUFACTURER.name ? (
        <>
          <h2 className="mt-14 text-2xl">Supplier</h2>
          <p className="measure mt-3 text-base text-ink-soft">
            {MANUFACTURER.name}
            {MANUFACTURER.country ? `, ${MANUFACTURER.country}` : ""}.{" "}
            {MANUFACTURER.note}
          </p>
        </>
      ) : null}

      <h2 className="mt-14 text-2xl">Published documentation</h2>
      <p className="measure mt-3 text-base text-ink-soft">
        The{" "}
        <Link href="/safety-data-sheet" className="link">
          safety data sheet
        </Link>{" "}
        is the full sixteen-section SDS for this product, version {SDS_VERSION}, revised{" "}
        {SDS_REVISION}. It covers hazard classification, composition, first aid, handling, storage,
        disposal and transport. Storage and the in-use limit are also stated on the{" "}
        <Link href="/" className="link">
          product page
        </Link>
        , and{" "}
        <Link href="/guides/how-to-store-bacteriostatic-water" className="link">
          how to store it
        </Link>{" "}
        and{" "}
        <Link href="/guides/how-long-does-bacteriostatic-water-last" className="link">
          how long a vial lasts
        </Link>{" "}
        work through what those two figures mean in practice.
      </p>

      <BuyCard />
    </div>
  );
}
