import {
  MAX_QUANTITY,
  MIN_QUANTITY,
  bundleById,
  priceOrder,
  type BundleId,
} from "@/config/funnel";

/**
 * Links that open the home page's buy box on a given order: `/?pack=ten#buy`,
 * `/?pack=five&qty=2#buy`, `/?pack=ten&extra=1#buy`. The reorder email and
 * the checkout-recovery fallback send people here; the buy box reads it on
 * load (usePackQuery in components/funnel/FunnelState.tsx). Only ever a
 * selection: nothing is charged until the customer presses the button.
 */

export interface PackSelection {
  bundleId: BundleId;
  quantity: number;
  extraVials: number;
}

export function packLink(sel: PackSelection): string {
  const params = new URLSearchParams({ pack: sel.bundleId });
  if (sel.quantity > 1) params.set("qty", String(sel.quantity));
  if (sel.extraVials > 0) params.set("extra", String(sel.extraVials));
  return `/?${params.toString()}#buy`;
}

/**
 * The selection a query string asks for, or null when it names no pack we
 * sell. A quantity out of range is clamped; loose vials the shop wouldn't
 * sell with that pack (priceOrder) are dropped rather than refusing the link.
 */
export function parsePackQuery(search: string): PackSelection | null {
  const params = new URLSearchParams(search);
  const bundle = bundleById(params.get("pack") ?? "");
  if (!bundle) return null;
  const qty = Number.parseInt(params.get("qty") ?? "1", 10);
  const quantity = Number.isFinite(qty) ? Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, qty)) : MIN_QUANTITY;
  const extra = Number.parseInt(params.get("extra") ?? "0", 10);
  const extraVials = Number.isFinite(extra) && priceOrder(bundle, quantity, extra) ? extra : 0;
  return { bundleId: bundle.id, quantity, extraVials };
}
