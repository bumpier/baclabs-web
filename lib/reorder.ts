import {
  bundleById,
  deliveryMinorFor,
  labKitEnabled,
  priceOrder,
  shipsFree,
  type Bundle,
} from "@/config/funnel";
import type { BrandCatalogue } from "@/brands/types";
import { isKitLine } from "@/lib/order-items";
import { packLink } from "@/lib/pack-link";
import { upsellCopy, upsellFor } from "@/lib/upsell";
import { catalogueDeliveryOptions, catalogueItem, catalogueShipsFree, packSizeName } from "@/lib/commerce/catalogue";
import { brandBuyLink } from "@/lib/commerce/links";
import { priceBrandLines, type BrandRequestLine } from "@/lib/commerce/pricing";

/**
 * What the "Running low?" and delivered emails offer (lib/customer-email.ts
 * sendRepurchaseNudgeEmail, deliveredEmail): the same order again at today's price, and the
 * step the buy box would offer from it (lib/upsell.ts), whose wording
 * scripts/test-upsell.ts already holds to what Stripe charges. Pure, so
 * scripts/test-reorder.ts covers it. Null for an order whose lines name no
 * pack we still sell; the email then falls back to its generic copy.
 */

export interface ReorderOffer {
  bundle: Bundle;
  quantity: number;
  extraVials: number;
  vials: number;
  /** Today's price of the same order, goods only. */
  goodsMinor: number;
  /** What delivery on it costs today; 0 when it ships free. */
  deliveryMinor: number;
  shipsFree: boolean;
  /** Site-relative link that opens the buy box on this order. */
  link: string;
  /** The step up from it, when there is one. */
  upsell: { line: string; linkText: string; link: string } | null;
}

interface StoredLine {
  bundleId?: unknown;
  bundleQty?: unknown;
  qty?: unknown;
  welcome?: unknown;
  gift?: unknown;
  addOn?: unknown;
}

export function reorderOffer(itemsJson: string): ReorderOffer | null {
  let lines: StoredLine[];
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) return null;
    lines = parsed as StoredLine[];
  } catch {
    return null;
  }

  // The pack: the last paid line that is not a free line (the welcome gift,
  // free vials staff promised) nor the loose vials or Lab Kits beside it.
  const pack = [...lines]
    .reverse()
    .find((l) => l.welcome !== true && l.gift !== true && l.addOn !== true && !isKitLine(l));
  const bundle = typeof pack?.bundleId === "string" ? bundleById(pack.bundleId) : undefined;
  const quantity = typeof pack?.bundleQty === "number" && pack.bundleQty > 0 ? pack.bundleQty : 0;
  if (!bundle || quantity === 0) return null;

  const loose = lines
    .filter((l) => l.addOn === true)
    .reduce((n, l) => n + (typeof l.qty === "number" ? l.qty : 0), 0);
  // Loose vials the shop no longer sells with this pack are left off.
  const priced = priceOrder(bundle, quantity, loose) ?? priceOrder(bundle, quantity);
  if (!priced) return null;

  const next = upsellFor(bundle, quantity, priced.extraVials);
  return {
    bundle,
    quantity,
    extraVials: priced.extraVials,
    vials: priced.vials,
    goodsMinor: priced.goodsMinor,
    deliveryMinor: deliveryMinorFor(priced.goodsMinor),
    shipsFree: shipsFree(priced.goodsMinor),
    link: packLink({ bundleId: bundle.id, quantity, extraVials: priced.extraVials }),
    upsell: next
      ? {
          line: upsellCopy(next).line,
          linkText: next.kind === "top-up" ? upsellCopy(next).accept : `Make it ${next.to.vials} vials`,
          link: packLink({ bundleId: next.to.bundle.id, quantity: next.to.quantity, extraVials: next.to.extraVials }),
        }
      : null,
  };
}

/** What another brand's emails offer instead of a ReorderOffer (brandReorderOffer). */
export interface BrandReorderOffer {
  lines: BrandRequestLine[];
  vials: number;
  goodsMinor: number;
  /** What the option Stripe's page would preselect costs; 0 when it ships free. */
  deliveryMinor: number;
  shipsFree: boolean;
  /** The service that goes free over the threshold ("next-day delivery"), else "UK delivery". */
  freeDelivery: string;
  freeFromMinor: number | null;
  /** Site-relative: the brand's origin goes in front. */
  link: string;
  /** "2 × 3-vial pack + 2 × Lab Kit", for the basket line of the recovery email. */
  basket: string;
}

/**
 * The same offer for another brand's order, from that brand's catalogue:
 * the same packs and add-ons again at today's prices, a link that opens the
 * brand's own storefront with them in the basket, and delivery as its own
 * checkout would charge it. No step up: the new brands have no upsell
 * ladder yet. Never BacLab's catalogue or links. Null when no pack on the
 * order is still sold, as reorderOffer is.
 */
export function brandReorderOffer(itemsJson: string, catalogue: BrandCatalogue): BrandReorderOffer | null {
  let lines: (StoredLine & { sku?: unknown })[];
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) return null;
    lines = parsed as (StoredLine & { sku?: unknown })[];
  } catch {
    return null;
  }

  // Every paid line the catalogue still sells. Free lines (the welcome
  // gift, promised vials) were never bought, and lines no longer on sale
  // are left off, as reorderOffer leaves off loose vials.
  const wanted: BrandRequestLine[] = [];
  for (const l of lines) {
    if (l.welcome === true || l.gift === true || typeof l.sku !== "string") continue;
    const item = catalogueItem(catalogue, l.sku);
    const qty = typeof l.bundleQty === "number" && l.bundleQty > 0 ? l.bundleQty : 0;
    if (!item || qty === 0) continue;
    if (item.kind === "pack" ? item.pack.available : item.addOn.available) wanted.push({ sku: l.sku, qty });
  }
  const opts = { labKitOnSale: labKitEnabled() };
  let priced = priceBrandLines(catalogue, wanted, opts);
  // An add-on that cannot be sold any more (the kit switched off) drops out
  // rather than taking the packs with it.
  if (!priced.ok) {
    priced = priceBrandLines(catalogue, wanted.filter((w) => catalogueItem(catalogue, w.sku)?.kind === "pack"), opts);
  }
  if (!priced.ok) return null;
  const order = priced.order;

  const offered = catalogueDeliveryOptions(catalogue, order.goodsMinor);
  const free = catalogue.delivery.options.find((o) => o.overThreshold === "free");
  const reordered = order.lines.map((l) => ({ sku: l.sku, qty: l.quantity }));
  return {
    lines: reordered,
    vials: order.vials,
    goodsMinor: order.goodsMinor,
    deliveryMinor: offered[0]?.priceMinor ?? 0,
    shipsFree: catalogueShipsFree(catalogue, order.goodsMinor),
    freeDelivery: free ? free.noun : "UK delivery",
    freeFromMinor: catalogue.delivery.freeFromMinor,
    link: brandBuyLink(reordered),
    basket: order.lines
      .map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ""}${l.kind === "pack" ? packSizeName(l.vials) : l.name}`)
      .join(" + "),
  };
}
