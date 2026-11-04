import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/commerce/LegalPage";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { brandPrivacy, brandTrackingFacts, legalIdentity } from "@/lib/commerce/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
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
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <JsonLd data={breadcrumbSchema(TITLE, PATH, brand.id)} />
      <LegalPage identity={legalIdentity(brand)} doc={doc} />
      <p className="mt-6 text-sm">
        <CookieSettingsButton ga4Id={STOREFRONT.tracking.ga4Id} className="link">
          Cookie settings
        </CookieSettingsButton>
      </p>
    </main>
  );
}
