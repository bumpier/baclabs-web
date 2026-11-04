/**
 * A brand's catalogue as its storefront's browser sees it (lib/commerce/view.ts).
 * Built in the brand's own server components (its root layout, its pages)
 * and passed to client components as a prop. A brand's bundle therefore
 * carries its own packs and prices and nothing else: no other brand, no
 * profile, nothing from config/.
 *
 * SERVER CODE: it reads config/funnel.ts (the Lab Kit's switch and parts)
 * and the payment providers the brand's profile lists; withStockLevel reads
 * the shared vial count from the database. What they return is plain,
 * serialisable data. BacLab has no catalogue and
 * never comes here; its storefront is config/funnel.ts as it always was.
 */
import type { BrandProfile } from "@/brands/types";
import { labKitContents, labKitEnabled } from "@/config/funnel";
import { formatCutoffHour } from "@/lib/delivery-date";
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
        // Next day is the one option whose transit depends on the time of
        // order, as config/funnel.ts words it and deliveryDetailAt dates
        // it: the warehouse's dispatch cutoff (lib/delivery-date.ts).
        cutoff: o.id === "next_day" ? formatCutoffHour() : null,
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
    // Not known here: this is built when the brand's modules load, with no
    // database read. withStockLevel below reads it when a page renders.
    stock: { low: false },
    tracking: { ga4Id: brand.analytics?.ga4Id?.trim() || null },
    mailingList: brand.mailingList ? { consentText: brand.mailingList.consentText } : null,
  };
}

/**
 * Whether a vial count is low enough for a storefront to say so: a count is
 * running (a delivery has been booked in on /admin/stock), it is at or under
 * the admin's own warning level (lib/vial-stock.ts LOW_STOCK_VIALS, the
 * dashboard's and /admin/stock's), and above nothing. At or below zero the
 * admin itself reads the count as wrong until a delivery is booked in or
 * the count corrected, so it is no figure to tell a customer anything by.
 * Pure, so npm run test:kit can hold it to each case.
 */
export function stockIsLow(stock: { since: string | null; left: number; low: boolean }): boolean {
  return stock.since !== null && stock.low && stock.left > 0;
}

/**
 * The view with its stock level read now, for a page that may show the
 * low-stock line. Every vial is shared, so it is the same for every brand.
 *
 * Anything that goes wrong reads as "not low", because saying nothing is
 * always true: the brand pages are prerendered by `next build`, which on
 * the VPS runs against a placeholder database, and revalidation reads the
 * real count at runtime. The stock module is loaded here, not at the top,
 * so a page that never asks loads nothing of the database.
 */
export async function withStockLevel(view: StorefrontView, now = new Date()): Promise<StorefrontView> {
  let low = false;
  try {
    const { loadVialStock } = await import("@/lib/vial-stock");
    low = stockIsLow(await loadVialStock(now));
  } catch (err) {
    // One line: Prisma's message ends with its cause, after the call it was in.
    const cause = err instanceof Error ? err.message.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) : String(err);
    console.warn(`[internal] the storefront's stock level is not known, so it reads as not low: ${cause ?? "unknown error"}`);
  }
  return { ...view, stock: { low } };
}
