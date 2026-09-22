/**
 * The arithmetic of stock, with no database in sight — lib/inventory/store.ts
 * feeds it rows and writes back what it decides. Kept pure so
 * scripts/test-inventory.ts can hold it to account.
 */

/** Stock of one SKU in one location, as the allocator sees it. */
export interface StockSlot {
  locationId: string;
  locationCode: string;
  pickSequence: number;
  quantity: number;
}

export interface AllocationPlan {
  /** Where to take stock from, in the order a picker should walk it. */
  takes: { locationId: string; quantity: number }[];
  /** What the shelves could not cover. Zero when fully allocated. */
  shortfall: number;
}

/**
 * Take `required` units from the slots, pick face first: lowest
 * pickSequence, then location code, so the same stock always drains in the
 * same, predictable order and the overflow shelf is only touched when the
 * pick face runs dry.
 */
export function planAllocation(required: number, slots: readonly StockSlot[]): AllocationPlan {
  const ordered = [...slots]
    .filter((s) => s.quantity > 0)
    .sort(
      (a, b) =>
        a.pickSequence - b.pickSequence || a.locationCode.localeCompare(b.locationCode)
    );

  const takes: AllocationPlan["takes"] = [];
  let outstanding = Math.max(0, required);
  for (const slot of ordered) {
    if (outstanding === 0) break;
    const take = Math.min(slot.quantity, outstanding);
    takes.push({ locationId: slot.locationId, quantity: take });
    outstanding -= take;
  }
  return { takes, shortfall: outstanding };
}

/** A SKU as the kit expander needs it. */
export interface SkuForDemand {
  id: string;
  code: string;
  components: { componentId: string; quantity: number }[];
}

/**
 * Turn "what was sold" into "what leaves the shelf". A kit contributes its
 * components times the quantity sold; anything else contributes itself.
 * Lines naming the same shelf SKU are summed, so an order for a single and a
 * 3-pack of the same vial asks the allocator for four once, not one and three.
 */
export function expandDemand(
  lines: readonly { sku: SkuForDemand; quantity: number }[]
): Map<string, number> {
  const demand = new Map<string, number>();
  const add = (skuId: string, quantity: number) =>
    demand.set(skuId, (demand.get(skuId) ?? 0) + quantity);

  for (const { sku, quantity } of lines) {
    if (sku.components.length === 0) {
      add(sku.id, quantity);
    } else {
      for (const c of sku.components) add(c.componentId, c.quantity * quantity);
    }
  }
  return demand;
}

/**
 * How many of a kit can be made from what is on the shelves: the scarcest
 * component decides. A kit with no components is not a kit, so this is only
 * called for ones that have some.
 */
export function kitsAvailable(components: readonly { quantity: number; available: number }[]): number {
  if (components.length === 0) return 0;
  return Math.min(
    ...components.map((c) => (c.quantity > 0 ? Math.floor(Math.max(0, c.available) / c.quantity) : 0))
  );
}
