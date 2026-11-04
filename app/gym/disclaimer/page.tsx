import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { brandDisclaimer, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/gym/components/legal-classes";
import { brand } from "../site";

/** The brand's product disclaimer, written from its profile (lib/commerce/legal.ts). */
const doc = brandDisclaimer(brand);

export const metadata: Metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path, brandId: brand.id });

export default function DisclaimerPage() {
  return (
    <main id="main" tabIndex={-1} className="gym-page outline-none">
      <JsonLd data={breadcrumbSchema(doc.title, doc.path, brand.id)} />
      <div className="gym-tape gym-tape-thin" aria-hidden="true" />
      <div className="gym-wrap gym-page-body">
        <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
      </div>
    </main>
  );
}
