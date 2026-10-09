import {
  bundleById,
  deliveryMinorFor,
  priceOrder,
  shipsFree,
  type Bundle,
} from "@/config/funnel";
import { packLink } from "@/lib/pack-link";
import { upsellCopy, upsellFor } from "@/lib/upsell";

/**
 * What the "Running low?" email offers (lib/customer-email.ts
 * sendRepurchaseNudgeEmail): the same order again at today's price, and the
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

  // The pack: the last paid line that is neither the welcome gift nor the
  // loose vials beside it.
  const pack = [...lines].reverse().find((l) => l.welcome !== true && l.addOn !== true);
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
