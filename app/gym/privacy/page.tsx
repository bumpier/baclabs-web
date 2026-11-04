import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { brandPrivacy, brandTrackingFacts, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/gym/components/legal-classes";
import { SITE } from "@/brands/gym/copy/site";
import { brand, STOREFRONT } from "../site";

const TITLE = "Privacy policy";
const PATH = "/privacy";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: "What personal data we collect, why, who we share it with, and your rights.",
  path: PATH,
  brandId: brand.id,
});

/**
 * Rendered per request, as BacLab's is: the notice describes the trackers
 * the site runs right now, and the Meta pixel is a runtime setting a static
 * page would go on misdescribing.
 */
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const doc = brandPrivacy(brand, await brandTrackingFacts(brand));
  return (
    <main id="main" tabIndex={-1} className="gym-page outline-none">
      <JsonLd data={breadcrumbSchema(TITLE, PATH, brand.id)} />
      <div className="gym-tape gym-tape-thin" aria-hidden="true" />
      <div className="gym-wrap gym-page-body">
        <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
        <p className="mt-8">
          <CookieSettingsButton ga4Id={STOREFRONT.tracking.ga4Id} className="gym-btn gym-btn-ghost-ink">
            {SITE.cookieSettings}
          </CookieSettingsButton>
        </p>
      </div>
    </main>
  );
}
