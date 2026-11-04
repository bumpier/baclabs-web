import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { brandReturns, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES, LEGAL_MAIN, LEGAL_SHEET } from "@/brands/wholesale/components/legal-classes";
import { brand } from "../site";

/** The brand's returns policy, written from its profile and catalogue (lib/commerce/legal.ts). */
const doc = brandReturns(brand);

export const metadata: Metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path, brandId: brand.id });

export default function ReturnsPage() {
  return (
    <main id="main" className={LEGAL_MAIN}>
      <JsonLd data={breadcrumbSchema(doc.title, doc.path, brand.id)} />
      <div className={LEGAL_SHEET}>
        <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
      </div>
    </main>
  );
}
