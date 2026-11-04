import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { brandReturns, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/beauty/components/legal-classes";
import { brand } from "../site";

/** The brand's returns policy, written from its profile and catalogue (lib/commerce/legal.ts). */
const doc = brandReturns(brand);

export const metadata: Metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path, brandId: brand.id });

export default function ReturnsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 pb-8 pt-10 sm:px-8 md:pt-14">
      <JsonLd data={breadcrumbSchema(doc.title, doc.path, brand.id)} />
      <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
    </main>
  );
}
