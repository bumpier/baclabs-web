import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseAddress } from "@/lib/orderAddress";
import {
  decideScan,
  isPickComplete,
  orderScanCode,
  parseScan,
  type PickLineState,
} from "@/lib/inventory/scan";

/**
 * The packing station's side of the database: open an order from its pick
 * label, tally scans against its pick list, and mark it packed when every
 * unit is accounted for.
 *
 * Scans move no stock — that left the shelf's count when the order was
 * allocated. They only fill in PickLine.pickedQuantity, the proof that what
 * went in the box is what the pick list asked for. The tally lives in the
 * database, not the browser, so a refresh or a second device carries on
 * where the first left off.
 */

type Tx = Prisma.TransactionClient;

/** Something the packer can act on, worded for them. */
export class PickingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickingError";
  }
}

export interface PickView {
  orderId: string;
  ref: string;
  status: string;
  customerName: string;
  postcode: string;
  lines: (PickLineState & { skuName: string })[];
  complete: boolean;
}

const PACKABLE = ["paid", "packed"];

async function loadView(db: Tx | typeof prisma, orderId: string): Promise<PickView> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { pickLines: { include: { sku: true, location: true } } },
  });
  if (!order) throw new PickingError("Order not found");
  const lines = order.pickLines
    .sort(
      (a, b) =>
        (a.location?.pickSequence ?? Infinity) - (b.location?.pickSequence ?? Infinity) ||
        (a.location?.code ?? "").localeCompare(b.location?.code ?? "")
    )
    .map((l) => ({
      id: l.id,
      locationCode: l.location?.code ?? null,
      skuCode: l.sku.code,
      skuBarcode: l.sku.barcode,
      skuName: l.sku.name,
      quantity: l.quantity,
      picked: l.pickedQuantity,
    }));
  return {
    orderId: order.id,
    ref: orderScanCode(order.id),
    status: order.status,
    customerName: order.customerName,
    postcode: parseAddress(order)?.postalCode ?? "",
    lines,
    complete: isPickComplete(lines),
  };
}

/** Open an order from a scanned (or typed) pick label. */
export async function openPickList(raw: string): Promise<PickView> {
  const scan = parseScan(raw);
  if (!scan || scan.kind !== "order") throw new PickingError("Scan the pick label first");

  const matches = await prisma.order.findMany({
    where: { id: { startsWith: scan.ref.toLowerCase() } },
    select: { id: true },
    take: 2,
  });
  if (matches.length === 0) throw new PickingError(`No order ${scan.ref}`);
  if (matches.length > 1) throw new PickingError(`${scan.ref} matches more than one order — open it from the order page`);

  const view = await loadView(prisma, matches[0]!.id);
  if (!PACKABLE.includes(view.status)) {
    throw new PickingError(`Order ${view.ref} is ${view.status} — do not pack it`);
  }
  if (view.lines.length === 0) throw new PickingError(`Order ${view.ref} has no pick list — it was not allocated`);
  return view;
}

export interface ScanResult {
  outcome: "good" | "bad" | "complete";
  message: string;
  view: PickView;
}

/**
 * Tally one scan. The update is conditional on the count it was decided
 * from, so two scans of the same unit arriving together count it once.
 */
export async function recordPickScan(orderId: string, raw: string): Promise<ScanResult> {
  const scan = parseScan(raw);
  return prisma.$transaction(async (tx) => {
    const view = await loadView(tx, orderId);
    if (!PACKABLE.includes(view.status)) {
      return { outcome: "bad" as const, message: `This order is ${view.status} — do not pack it`, view };
    }
    if (!scan) return { outcome: "bad" as const, message: "Could not read that barcode", view };

    const decision = decideScan(view.lines, scan);
    if (!decision.ok) return { outcome: "bad" as const, message: decision.message, view };

    for (const u of decision.updates) {
      const before = view.lines.find((l) => l.id === u.lineId)!.picked;
      const { count } = await tx.pickLine.updateMany({
        where: { id: u.lineId, pickedQuantity: before },
        data: { pickedQuantity: u.picked },
      });
      if (count === 0) throw new PickingError("That was scanned twice at once — scan it again");
    }

    const after = await loadView(tx, orderId);
    return {
      outcome: after.complete ? ("complete" as const) : ("good" as const),
      message: after.complete ? `${decision.message} — all picked` : decision.message,
      view: after,
    };
  });
}

/** Clear the tally, for a mis-pick found at the bench. */
export async function resetPicks(orderId: string): Promise<PickView> {
  await prisma.pickLine.updateMany({ where: { orderId }, data: { pickedQuantity: 0 } });
  return loadView(prisma, orderId);
}

/** paid → packed, only once every unit has been scanned. */
export async function markPacked(orderId: string): Promise<PickView> {
  const view = await loadView(prisma, orderId);
  if (!view.complete) throw new PickingError("Not everything is picked yet");
  if (view.status === "paid") {
    await prisma.order.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "packed" } });
  }
  return loadView(prisma, orderId);
}
