import type { Prisma } from "@prisma/client";
import { allocateOrder } from "@/lib/inventory/store";
import type { InventoryMode } from "@/lib/inventory/mode";

/**
 * Taking stock for a paid order. Shared by fulfillPaidOrder (a sale) and
 * lib/plans/boxes.ts (a prepaid plan box), which must take stock exactly the
 * same way but must not run the rest of fulfilment (no second confirmation
 * email, no second Meta Purchase, no welcome vial).
 *
 * Legacy mode decrements Product.stock inside the transaction that marks the
 * order paid, so the two cannot come apart. Warehouse mode allocates to shelf
 * locations AFTER that transaction commits: a problem there (a SKU deleted
 * since checkout) must not roll back an order that is paid for. Only the
 * caller that won the paid claim gets here, so it runs once; if allocation
 * fails the order page shows the order unallocated, with a button to retry.
 */
export async function takeStockInTransaction(
  tx: Prisma.TransactionClient,
  mode: InventoryMode,
  itemsJson: string
): Promise<void> {
  if (mode !== "legacy") return;
  const items = JSON.parse(itemsJson) as { productId: string; qty: number }[];
  for (const item of items) {
    await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } });
  }
}

export async function allocateAfterPayment(orderId: string, mode: InventoryMode): Promise<void> {
  if (mode !== "warehouse") return;
  try {
    const { shortfall } = await allocateOrder(orderId, "system");
    if (shortfall > 0) {
      console.error(`[internal] order ${orderId} paid with ${shortfall} unit(s) short on the shelves`);
    }
  } catch (err) {
    console.error(`[internal] stock allocation failed for order ${orderId}`, err);
  }
}
