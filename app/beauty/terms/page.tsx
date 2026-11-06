import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { brandTerms, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/beauty/components/legal-classes";
import { brand } from "../site";

/** The brand's terms, written from its profile and catalogue (lib/commerce/legal.ts). */
const doc = brandTerms(brand);

export const metadata: Metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path, brandId: brand.id });

export default function TermsPage() {
  return (
    <main id="main" className="bb-wrap max-w-[74rem] pt-8 md:pt-14">
      <JsonLd data={breadcrumbSchema(doc.title, doc.path, brand.id)} />
      <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
    </main>
  );
}
