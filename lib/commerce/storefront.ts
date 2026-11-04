/**
 * A brand's catalogue as its storefront's browser sees it (lib/commerce/view.ts).
 * Built in the brand's own server components (its root layout, its pages)
 * and passed to client components as a prop. A brand's bundle therefore
 * carries its own packs and prices and nothing else: no other brand, no
 * profile, nothing from config/.
 *
 * SERVER CODE: it reads config/funnel.ts (the Lab Kit's switch and parts)
 * and the payment providers the brand's profile lists. What it returns is
 * plain, serialisable data. BacLab has no catalogue and
 * never comes here; its storefront is config/funnel.ts as it always was.
 */
import type { BrandProfile } from "@/brands/types";
import { labKitContents, labKitEnabled } from "@/config/funnel";
import { packPerVialMinor } from "@/lib/commerce/catalogue";
import { GIFT_NOTE_MAX } from "@/lib/commerce/gift-note";
import { MAX_BRAND_LINES, MAX_LINE_QTY } from "@/lib/commerce/pricing";
import { listedPaymentAdapters } from "@/lib/commerce/payments";
import type { StorefrontView } from "@/lib/commerce/view";

export function storefrontView(brand: BrandProfile): StorefrontView {
  const catalogue = brand.catalogue;
  if (!catalogue) throw new Error(`storefrontView: ${brand.id} has no catalogue`);
  // Read when the page renders, as the checkout reads it when it prices: a
  // switched-off Lab Kit is listed as unavailable rather than left out, so a
  // storefront can say it is coming.
  const kitOnSale = labKitEnabled();

  return {
    currency: "GBP",
    packs: catalogue.packs.map((p) => ({
      sku: p.sku,
      label: p.label,
      vials: p.vials,
      priceMinor: p.priceMinor,
      perVialMinor: packPerVialMinor(p),
      available: p.available,
    })),
    addOns: catalogue.addOns.map((a) => ({
      sku: a.sku,
      name: a.name,
      priceMinor: a.priceMinor,
      available: a.available && (a.ships !== "lab-kit" || kitOnSale),
      contents: a.ships === "lab-kit" ? labKitContents(1) : "",
      perVial: a.ships === "lab-kit",
    })),
    delivery: {
      options: catalogue.delivery.options.map((o) => ({
        id: o.id,
        label: o.label,
        carrier: o.carrier,
        transit: o.transit,
        detail: o.detail,
        priceMinor: o.priceMinor,
        overThreshold: o.overThreshold,
      })),
      freeFromMinor: catalogue.delivery.freeFromMinor,
    },
    limits: { maxVials: catalogue.maxVials, maxLineQty: MAX_LINE_QTY, maxLines: MAX_BRAND_LINES, maxGiftNote: GIFT_NOTE_MAX },
    flags: {
      businessDetails: catalogue.collectBusinessDetails,
      promotionCodes: catalogue.allowPromotionCodes,
      giftNote: catalogue.collectGiftNote,
    },
    // The ways to pay the profile lists (lib/commerce/payments), in its
    // words when it has some. Never whether they are configured: the
    // brand's pages are prerendered by `next build`, which has no payment
    // keys, so a view that waited for them lost its checkout button on
    // every deploy until the page revalidated. The checkout checks when the
    // customer pays, and answers the neutral 503 while a listed provider is
    // off (BacLab's cards switched off, a brand's own credentials unset).
    // Empty only when the profile lists none: then the storefront shows no
    // checkout button at all. The label only: each method's terms and
    // refunds sentences name the provider, so they stay here, for the
    // legal pages, and never ride to the browser with every page.
    payment: {
      methods: listedPaymentAdapters(brand).map((adapter) => {
        const words = brand.payment?.methods.find((m) => m.id === adapter.id);
        return { id: adapter.id, label: words?.label ?? adapter.label };
      }),
    },
    tracking: { ga4Id: brand.analytics?.ga4Id?.trim() || null },
    mailingList: brand.mailingList ? { consentText: brand.mailingList.consentText } : null,
  };
}
