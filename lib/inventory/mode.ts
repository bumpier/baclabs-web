import { readSetting, SETTING_KEYS, writeSetting } from "@/lib/settings";

/**
 * Which stock count the shop sells against.
 *
 *  - "legacy": Product.stock, the single vial counter the site launched with.
 *    Checkout checks it, payment decrements it. The warehouse tables can be
 *    filled in alongside without any order touching them.
 *  - "warehouse": SKUs, locations and the ledger. Checkout checks what is on
 *    the shelves; payment allocates the order to locations, which is what the
 *    pick list prints.
 *
 * One switch for the whole shop, flipped from /admin/inventory once every
 * storefront pack resolves to a SKU. Per-SKU cut-over was rejected: it would
 * let the same vials be counted in two places at once.
 *
 * Reads never throw (see lib/settings.ts) and default to legacy, so a
 * database hiccup can never quietly move checkout onto empty shelves.
 */
export type InventoryMode = "legacy" | "warehouse";

export async function getInventoryMode(): Promise<InventoryMode> {
  return (await readSetting(SETTING_KEYS.inventoryMode)) === "warehouse" ? "warehouse" : "legacy";
}

export async function setInventoryMode(mode: InventoryMode): Promise<void> {
  await writeSetting(SETTING_KEYS.inventoryMode, mode);
}
