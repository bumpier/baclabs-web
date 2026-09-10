import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { brand } from "@/config/brand";
import { VIAL_ML } from "@/config/funnel";
import { canonicalOrigin } from "@/lib/site-url";
import { JsonLd } from "@/components/JsonLd";
import { DilutionCalculator } from "@/components/guides/DilutionCalculator";
import { FaqList } from "@/components/guides/FaqList";
import { BuyCard, DataTable } from "@/components/guides/GuideArticle";
import { faqPageSchema, pageBreadcrumbSchema } from "@/lib/guide-seo";
import { FACTS } from "@/content/facts";
import type { GuideFaq } from "@/content/guides/types";
import { contentHref } from "@/lib/blog-migration";

export const dynamic = "force-static";

const DESCRIPTION =
  "Work out the concentration when a substance is dissolved in bacteriostatic water, or the volume of diluent to add for a target concentration. Worked examples included.";

export const metadata: Metadata = pageMetadata({
  title: "Bacteriostatic water dilution calculator",
  description: DESCRIPTION,
  path: "/calculator",
});

const FAQ: GuideFaq[] = [
  {
    q: "How is concentration calculated?",
    a: "Concentration equals the mass of substance in the vial divided by the volume of diluent added. 5 mg dissolved in 2 mL gives 2.5 mg/mL, which is 2,500 µg/mL. Each 0.1 mL aliquot of that solution contains 0.25 mg.",
  },
  {
    q: "What units does the calculator use?",
    a: "Milligrams for mass, millilitres for volume, and mg/mL for concentration, with µg shown alongside. 1 mg is 1,000 µg. 1 mL is 100 units on a 100-unit 1 mL syringe scale, so 0.1 mL is 10 units.",
  },
  {
    q: "Does adding the diluent change the volume?",
    a: "The calculator assumes the dissolved substance adds no measurable volume, which is a fair approximation for a few milligrams in a millilitre or more. For larger masses the true volume is slightly higher and the true concentration slightly lower.",
  },
  {
    q: "How many times can a 10 mL vial of diluent be used?",
    a: `That depends only on how much is withdrawn each time: a ${VIAL_ML} mL vial gives ten 1 mL draws or five 2 mL draws. Whatever is left must be discarded ${FACTS.openedLimitDays} days after the stopper is first punctured.`,
  },
  {
    q: "Which diluent does this assume?",
    a: `Any. The arithmetic is the same for bacteriostatic water, sterile water or saline. The difference between them is the preservative: bacteriostatic water contains a bacteriostatic preservative, which is what allows one vial to be entered more than once.`,
  },
];

const EXAMPLES = {
  caption: "Worked examples",
  columns: ["Substance in vial", "Diluent added", "Concentration", "Per 0.1 mL aliquot"],
  rows: [
    ["2 mg", "1 mL", "2 mg/mL", "0.2 mg (200 µg)"],
    ["5 mg", "1 mL", "5 mg/mL", "0.5 mg (500 µg)"],
    ["5 mg", "2 mL", "2.5 mg/mL", "0.25 mg (250 µg)"],
    ["10 mg", "2 mL", "5 mg/mL", "0.5 mg (500 µg)"],
    ["10 mg", "5 mL", "2 mg/mL", "0.2 mg (200 µg)"],
    ["50 mg", "5 mL", "10 mg/mL", "1 mg (1,000 µg)"],
  ],
};

export default function CalculatorPage() {
  const site = canonicalOrigin();
  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Bacteriostatic water dilution calculator",
    url: `${site}/calculator`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    publisher: { "@type": "Organization", name: brand.company.legalName || brand.name, url: site },
    description: DESCRIPTION,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={pageBreadcrumbSchema("Dilution calculator", "/calculator")} />
      <JsonLd data={appSchema} />
      <JsonLd data={faqPageSchema(FAQ)} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link href={contentHref("/guides")} className="link">
          Guides
        </Link>
      </nav>
      <h1 className="mt-4 text-3xl sm:text-4xl">Dilution calculator</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Enter what is in the vial and how much diluent goes in, and read the concentration. Or set
        the concentration you want and read the volume to add.
      </p>

      <div className="mt-8">
        <DilutionCalculator />
      </div>

      <section className="mt-14" aria-labelledby="examples-heading">
        <h2 id="examples-heading" className="text-2xl">
          Worked examples
        </h2>
        <p className="measure mt-3 text-base text-ink-soft">
          The same arithmetic across common vial contents. Mass divided by volume gives mg/mL;
          multiply by the aliquot volume to see what each withdrawal contains.
        </p>
        <DataTable table={EXAMPLES} />
      </section>

      <section className="mt-14" aria-labelledby="units-heading">
        <h2 id="units-heading" className="text-2xl">
          Units
        </h2>
        <ul className="prose-guide mt-4 list-disc pl-5">
          <li>1 mg = 1,000 µg (micrograms). 1 g = 1,000 mg.</li>
          <li>1 mL = 1 cc. On a 1 mL syringe graduated in 100 units, 0.1 mL is 10 units and 0.5 mL is 50 units.</li>
          <li>mg/mL × aliquot volume in mL = mg in the aliquot.</li>
          <li>
            A {VIAL_ML} mL vial of diluent yields {VIAL_ML} draws of 1 mL, {VIAL_ML * 2} of 0.5 mL, or{" "}
            {VIAL_ML * 10} of 0.1 mL.
          </li>
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="calc-faq-heading">
        <h2 id="calc-faq-heading" className="text-2xl">
          Questions
        </h2>
        <div className="mt-5">
          <FaqList items={FAQ} />
        </div>
      </section>

      <BuyCard />

      <p className="mt-10 text-xs text-ink-soft">
        This tool does arithmetic. It does not recommend any quantity, concentration or use, and it
        is not a substitute for a laboratory protocol. See the{" "}
        <Link href="/disclaimer" className="link">
          product disclaimer
        </Link>
        .
      </p>
    </div>
  );
}
