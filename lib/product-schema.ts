import { brand } from "@/config/brand";
import { brandFor, DEFAULT_BRAND } from "@/brands/registry";
import { DELIVERY, RETURNS, deliveryMinorFor } from "@/config/funnel";
import { FACTS } from "@/content/facts";
import { canonicalOrigin } from "@/lib/site-url";

/**
 * The origin and organisation name for a brand's structured data, BacLab by
 * default. Another brand's come from its profile, never canonicalOrigin():
 * its pages are prerendered with no Host header to go on.
 */
function schemaSite(brandId: string): { origin: string; orgName: string } {
  if (brandId === DEFAULT_BRAND) return { origin: canonicalOrigin(), orgName: brand.company.legalName || brand.name };
  const b = brandFor(brandId);
  return { origin: b.origin, orgName: b.legalName || b.name };
}

/**
 * The parts of the Product structured data that Google's merchant-listing
 * rich result reads beyond price: shipping, returns and identifiers. Each
 * reads the same config the storefront charges from, so the snippet in
 * search can never promise a delivery the checkout does not give.
 */

/**
 * OfferShippingDetails for an offer of this value. The rate is what Stripe
 * charges for that basket, so the £40 threshold shows as "free" on the packs
 * that qualify and the standard price on the ones that do not. `deliveryTime` is emitted
 * only once DELIVERY.handlingDays and transitDays hold real figures.
 */
export function shippingDetailsFor(offerMinor: number): Record<string, unknown> | undefined {
  if (DELIVERY.mode === "unknown") return undefined;
  const rate = deliveryMinorFor(offerMinor);
  const details: Record<string, unknown> = {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: (rate / 100).toFixed(2),
      currency: "GBP",
    },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
  };
  if (DELIVERY.handlingDays && DELIVERY.transitDays) {
    details.deliveryTime = {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: DELIVERY.handlingDays[0],
        maxValue: DELIVERY.handlingDays[1],
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: DELIVERY.transitDays[0],
        maxValue: DELIVERY.transitDays[1],
        unitCode: "DAY",
      },
    };
  }
  return details;
}

/** MerchantReturnPolicy mirroring /returns. */
export function returnPolicySchema(brandId: string = DEFAULT_BRAND): Record<string, unknown> {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "GB",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURNS.windowDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: RETURNS.customerPaysReturn
      ? "https://schema.org/ReturnShippingFees"
      : "https://schema.org/FreeReturn",
    refundType: "https://schema.org/FullRefund",
    merchantReturnLink: `${schemaSite(brandId).origin}${RETURNS.path}`,
    // The sealed-goods exception has no schema.org field, so it goes in the
    // description rather than being silently dropped from the summary.
    description: `Unopened vials with seals intact may be returned within ${RETURNS.windowDays} days of delivery. A vial that has been opened or punctured is sealed for hygiene reasons and cannot be returned, except where faulty or damaged.`,
  };
}

/** The chemistry facts as PropertyValue entries. */
export function productPropertiesSchema(): Record<string, unknown>[] {
  return [
    { "@type": "PropertyValue", name: "Preservative", value: "Bacteriostatic preservative" },
    { "@type": "PropertyValue", name: "CAS number (water)", value: FACTS.casWater },
    { "@type": "PropertyValue", name: "Appearance", value: FACTS.appearance },
    { "@type": "PropertyValue", name: "In-use limit once opened", value: FACTS.openedLimit },
    { "@type": "PropertyValue", name: "Hazard classification", value: FACTS.hazardClassification },
  ];
}

/** The synonyms, for Product `alternateName`. */
export function productAlternateNames(): string[] {
  return [...FACTS.synonyms];
}

export function organizationRef(brandId: string = DEFAULT_BRAND): Record<string, unknown> {
  const site = schemaSite(brandId);
  return { "@id": `${site.origin}/#organization`, "@type": "Organization", name: site.orgName };
}

/**
 * `priceValidUntil` for every Offer. Google asks for it once a price is
 * stated; without it a stale cached price can be shown over the live one.
 * It is a rolling horizon, not a promise: the page regenerates (see the
 * `revalidate` on the store layout) so the date always sits ahead of today,
 * and a real price change ships a new page long before it lapses. It is a
 * date only and carries no figure, so nothing here can touch the reference
 * price used by the sale presentation.
 */
export function priceValidUntil(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 60);
  return d.toISOString().slice(0, 10);
}
