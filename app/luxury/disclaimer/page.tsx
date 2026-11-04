import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { brandDisclaimer, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/luxury/components/legal";
import { brand } from "../site";

/** The brand's product disclaimer, written from its profile (lib/commerce/legal.ts). */
const doc = brandDisclaimer(brand);

export const metadata: Metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path, brandId: brand.id });

export default function DisclaimerPage() {
  return (
    <main id="main" className="rv-wrap rv-page">
      <JsonLd data={breadcrumbSchema(doc.title, doc.path, brand.id)} />
      <div className="rv-legal">
        <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
      </div>
    </main>
  );
}
