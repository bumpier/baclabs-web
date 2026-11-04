import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { brandPrivacy, brandTrackingFacts, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { LEGAL_CLASSES } from "@/brands/beauty/components/legal-classes";
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
    <main id="main" className="mx-auto w-full max-w-3xl px-5 pb-8 pt-10 sm:px-8 md:pt-14">
      <JsonLd data={breadcrumbSchema(TITLE, PATH, brand.id)} />
      <LegalPage identity={legalIdentity(brand)} doc={doc} classNames={LEGAL_CLASSES} />
      <p className="mt-6 text-[0.9375rem]">
        <CookieSettingsButton ga4Id={STOREFRONT.tracking.ga4Id} className="au-link cursor-pointer">
          Cookie settings
        </CookieSettingsButton>
      </p>
    </main>
  );
}
