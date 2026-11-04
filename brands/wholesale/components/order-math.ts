/**
 * The order desk's arithmetic, from the storefront view alone: how many
 * vials the basket holds, what they cost a vial, what they save against the
 * smallest pack's rate, how many more of a pack still fit one order, and
 * whether the same vials cost less as other packs.
 *
 * Display only, like the view itself: the checkout prices the order again
 * from the catalogue and is the authority on every refusal. Pure, and it
 * imports nothing but the view, so the browser bundle carries this brand's
 * figures and nothing else.
 */
import { packSavingMinor, type BasketLine, type PackView, type StorefrontView } from "@/lib/commerce/view";

const packOf = (view: StorefrontView, sku: string) => view.packs.find((p) => p.sku === sku);

/** Vials in the basket's packs. */
export function basketVials(view: StorefrontView, lines: readonly BasketLine[]): number {
  return lines.reduce((n, l) => n + (packOf(view, l.sku)?.vials ?? 0) * l.qty, 0);
}

/** The basket's packs at their pack prices, in pence (add-ons left out). */
export function packGoodsMinor(view: StorefrontView, lines: readonly BasketLine[]): number {
  return lines.reduce((n, l) => n + (packOf(view, l.sku)?.priceMinor ?? 0) * l.qty, 0);
}

/** What one vial costs across the basket's packs, rounded to the penny. null with no vials. */
export function perVialMinor(view: StorefrontView, lines: readonly BasketLine[]): number | null {
  const n = basketVials(view, lines);
  return n > 0 ? Math.round(packGoodsMinor(view, lines) / n) : null;
}

/** The sum of each pack's saving (the price list's own figure) times its count. */
export function basketSavingMinor(view: StorefrontView, lines: readonly BasketLine[]): number {
  return lines.reduce((n, l) => {
    const pack = packOf(view, l.sku);
    return n + (pack ? packSavingMinor(view, pack) * l.qty : 0);
  }, 0);
}

/**
 * The most of `pack` the basket can hold with everything else in it left as
 * it is: the order's vial limit and the per-line limit, whichever is lower.
 */
export function maxQtyFor(view: StorefrontView, lines: readonly BasketLine[], pack: PackView): number {
  const others = basketVials(view, lines.filter((l) => l.sku !== pack.sku));
  const room = Math.max(0, view.limits.maxVials - others);
  return Math.min(view.limits.maxLineQty, Math.floor(room / pack.vials));
}

/**
 * The cheapest way to buy exactly the basket's vials from the packs on
 * sale, when it is cheaper than the basket as it stands: the lines to
 * switch to (its add-ons kept) and the pence it saves. null when the basket
 * is already the cheapest, is empty, or is past what one order holds.
 */
export function cheaperPacks(
  view: StorefrontView,
  lines: readonly BasketLine[]
): { lines: BasketLine[]; packs: { pack: PackView; qty: number }[]; savesMinor: number } | null {
  const target = basketVials(view, lines);
  if (target === 0 || target > view.limits.maxVials) return null;
  const sale = view.packs.filter((p) => p.available);
  if (sale.length < 2) return null;

  // Cheapest cost of exactly v vials, and the pack that last got there.
  const cost = new Array<number>(target + 1).fill(Infinity);
  const via = new Array<number>(target + 1).fill(-1);
  cost[0] = 0;
  for (let v = 1; v <= target; v++) {
    sale.forEach((p, i) => {
      if (p.vials <= v && cost[v - p.vials]! + p.priceMinor < cost[v]!) {
        cost[v] = cost[v - p.vials]! + p.priceMinor;
        via[v] = i;
      }
    });
  }
  const now = packGoodsMinor(view, lines);
  if (!Number.isFinite(cost[target]) || cost[target]! >= now) return null;

  const counts = new Map<string, number>();
  for (let v = target; v > 0; v -= sale[via[v]!]!.vials) {
    const sku = sale[via[v]!]!.sku;
    counts.set(sku, (counts.get(sku) ?? 0) + 1);
  }
  if ([...counts.values()].some((q) => q > view.limits.maxLineQty)) return null;

  const packs = sale.filter((p) => counts.has(p.sku)).map((pack) => ({ pack, qty: counts.get(pack.sku)! }));
  const addOns = lines.filter((l) => !packOf(view, l.sku));
  const next = [...packs.map(({ pack, qty }) => ({ sku: pack.sku, qty })), ...addOns];
  if (next.length > view.limits.maxLines) return null;
  return { lines: next, packs, savesMinor: now - cost[target]! };
}
