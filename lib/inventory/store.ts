import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRODUCT } from "@/config/funnel";
import { expandDemand, kitsAvailable, planAllocation } from "@/lib/inventory/allocation";
import { normaliseCode } from "@/lib/inventory/codes";
import { soldLines, storefrontSkuCodes, VIAL_SKU_CODE } from "@/lib/inventory/demand";

/**
 * Every write to stock goes through this file, and every one of them is a
 * StockMovement written in the same transaction as the StockLevel it
 * changes. That pairing is the whole design: the level says how many are on
 * the shelf, the ledger says why, and neither can drift from the other.
 *
 * Stock never goes below zero. A manual adjustment that would take it there
 * is refused; an order that needs more than the shelves hold is allocated as
 * far as it can be and the rest recorded as a shortfall, to be retried once
 * stock is booked in — the order is already paid for, so refusing it is not
 * an option.
 */

type Tx = Prisma.TransactionClient;

/** A rule the operator broke, worded for them. Anything else is a bug. */
export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type MovementType = "RECEIVE" | "ADJUST" | "TRANSFER" | "SALE" | "CANCEL";

interface Movement {
  skuId: string;
  locationId: string;
  /** Signed. */
  quantity: number;
  type: MovementType;
  reason?: string;
  reference?: string;
  orderId?: string | null;
  actor: string;
}

/**
 * Change one level and write its ledger row. A decrement is conditional on
 * there being enough — the WHERE clause, not an earlier read, is what
 * guarantees the level cannot go negative under concurrent writes.
 */
async function applyMovement(tx: Tx, m: Movement): Promise<void> {
  if (m.quantity === 0) return;
  if (m.quantity < 0) {
    const { count } = await tx.stockLevel.updateMany({
      where: { skuId: m.skuId, locationId: m.locationId, quantity: { gte: -m.quantity } },
      data: { quantity: { decrement: -m.quantity } },
    });
    if (count === 0) {
      const level = await tx.stockLevel.findUnique({
        where: { skuId_locationId: { skuId: m.skuId, locationId: m.locationId } },
        include: { sku: true, location: true },
      });
      throw new InventoryError(
        level
          ? `Only ${level.quantity} × ${level.sku.code} in ${level.location.code}`
          : "There is none of that SKU in that location"
      );
    }
  } else {
    await tx.stockLevel.upsert({
      where: { skuId_locationId: { skuId: m.skuId, locationId: m.locationId } },
      create: { skuId: m.skuId, locationId: m.locationId, quantity: m.quantity },
      update: { quantity: { increment: m.quantity } },
    });
  }
  await tx.stockMovement.create({
    data: {
      skuId: m.skuId,
      locationId: m.locationId,
      quantity: m.quantity,
      type: m.type,
      reason: m.reason ?? "",
      reference: m.reference ?? "",
      orderId: m.orderId ?? null,
      actor: m.actor,
    },
  });
}

async function stockedSku(tx: Tx, skuId: string) {
  const sku = await tx.sku.findUnique({ where: { id: skuId }, include: { components: true } });
  if (!sku) throw new InventoryError("SKU not found");
  if (sku.components.length > 0) {
    throw new InventoryError(
      `${sku.code} is a kit — it holds no stock of its own. Book in its components instead.`
    );
  }
  return sku;
}

async function activeLocation(tx: Tx, locationId: string) {
  const location = await tx.location.findUnique({ where: { id: locationId }, include: { warehouse: true } });
  if (!location) throw new InventoryError("Location not found");
  if (!location.active || !location.warehouse.active) {
    throw new InventoryError(`Location ${location.code} is switched off`);
  }
  return location;
}

// ── Manual movements ──────────────────────────────────────────────

export async function receiveStock(input: {
  skuId: string;
  locationId: string;
  quantity: number;
  reference: string;
  actor: string;
}): Promise<void> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("Enter how many were received");
  }
  await prisma.$transaction(async (tx) => {
    await stockedSku(tx, input.skuId);
    await activeLocation(tx, input.locationId);
    await applyMovement(tx, {
      skuId: input.skuId,
      locationId: input.locationId,
      quantity: input.quantity,
      type: "RECEIVE",
      reason: "Goods in",
      reference: input.reference,
      actor: input.actor,
    });
  });
}

/**
 * A correction: a count that disagrees, breakage, a pack split into singles
 * (which is two adjustments — the pack out, the singles in — each with its
 * reason). Always explained; the reason is required upstream.
 */
export async function adjustStock(input: {
  skuId: string;
  locationId: string;
  delta: number;
  reason: string;
  reference: string;
  actor: string;
}): Promise<void> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new InventoryError("Enter the change, e.g. 5 to add or -2 to remove");
  }
  await prisma.$transaction(async (tx) => {
    await stockedSku(tx, input.skuId);
    // A removal from a switched-off location is allowed — that is how one is
    // emptied before it is retired. Adding to one is not.
    if (input.delta > 0) await activeLocation(tx, input.locationId);
    await applyMovement(tx, {
      skuId: input.skuId,
      locationId: input.locationId,
      quantity: input.delta,
      type: "ADJUST",
      reason: input.reason,
      reference: input.reference,
      actor: input.actor,
    });
  });
}

export async function transferStock(input: {
  skuId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  actor: string;
}): Promise<void> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("Enter how many to move");
  }
  if (input.fromLocationId === input.toLocationId) {
    throw new InventoryError("Pick two different locations");
  }
  await prisma.$transaction(async (tx) => {
    await stockedSku(tx, input.skuId);
    const from = await tx.location.findUnique({ where: { id: input.fromLocationId } });
    if (!from) throw new InventoryError("Location not found");
    const to = await activeLocation(tx, input.toLocationId);
    // One reference on both rows pairs them in the ledger.
    const reference = `${from.code} → ${to.code}`;
    await applyMovement(tx, {
      skuId: input.skuId,
      locationId: from.id,
      quantity: -input.quantity,
      type: "TRANSFER",
      reference,
      actor: input.actor,
    });
    await applyMovement(tx, {
      skuId: input.skuId,
      locationId: to.id,
      quantity: input.quantity,
      type: "TRANSFER",
      reference,
      actor: input.actor,
    });
  });
}

// ── Reading stock ─────────────────────────────────────────────────

/**
 * On-hand per SKU id, across every active location in every active
 * warehouse — the number the user asked for: "the total amount of stock for
 * that specific item, whatever location it is in".
 */
export async function onHandBySku(db: Tx | typeof prisma = prisma): Promise<Map<string, number>> {
  const rows = await db.stockLevel.groupBy({
    by: ["skuId"],
    where: { quantity: { gt: 0 }, location: { active: true, warehouse: { active: true } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.skuId, r._sum.quantity ?? 0]));
}

/**
 * How many of a SKU can be sold right now: its own stock, or for a kit, as
 * many as the scarcest component allows. Null when no active SKU has that
 * code, which the caller treats as "not for sale".
 */
export async function availableToSell(code: string): Promise<number | null> {
  const sku = await prisma.sku.findUnique({
    where: { code: normaliseCode(code) },
    include: { components: { include: { component: true } } },
  });
  if (!sku || !sku.active) return null;
  const onHand = await onHandBySku();
  if (sku.components.length === 0) return onHand.get(sku.id) ?? 0;
  if (sku.components.some((c) => !c.component.active)) return 0;
  return kitsAvailable(
    sku.components.map((c) => ({ quantity: c.quantity, available: onHand.get(c.componentId) ?? 0 }))
  );
}

// ── Orders ────────────────────────────────────────────────────────

export interface AllocationOutcome {
  /** Units allocated to a location by THIS call. */
  allocated: number;
  /** Units still waiting for stock after it. */
  shortfall: number;
}

async function slotsFor(tx: Tx, skuId: string) {
  const levels = await tx.stockLevel.findMany({
    where: { skuId, quantity: { gt: 0 }, location: { active: true, warehouse: { active: true } } },
    include: { location: true },
  });
  return levels.map((l) => ({
    locationId: l.locationId,
    locationCode: l.location.code,
    pickSequence: l.location.pickSequence,
    quantity: l.quantity,
  }));
}

/** Take stock for one shelf SKU and write the pick lines that say where from. */
async function allocateSku(tx: Tx, orderId: string, skuId: string, quantity: number, actor: string) {
  const plan = planAllocation(quantity, await slotsFor(tx, skuId));
  for (const take of plan.takes) {
    await applyMovement(tx, {
      skuId,
      locationId: take.locationId,
      quantity: -take.quantity,
      type: "SALE",
      reason: "Order",
      reference: orderId.slice(0, 8),
      orderId,
      actor,
    });
    await tx.pickLine.create({
      data: { orderId, skuId, locationId: take.locationId, quantity: take.quantity },
    });
  }
  return { allocated: quantity - plan.shortfall, shortfall: plan.shortfall };
}

/**
 * Allocate a paid order to shelf locations. Safe to call again: the first
 * call allocates everything it can; any later call only retries shortfall
 * lines (those with no location). That is what the "Allocate stock" button
 * on the order page does after stock has been booked in.
 *
 * Throws InventoryError, allocating nothing, when an item's SKU does not
 * exist — half an order allocated against a guessed SKU would be worse than
 * none.
 */
export async function allocateOrder(orderId: string, actor: string): Promise<AllocationOutcome> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { pickLines: true } });
    if (!order) throw new InventoryError("Order not found");
    if (!["paid", "packed"].includes(order.status)) {
      throw new InventoryError(`A ${order.status} order is not allocated`);
    }

    let allocated = 0;
    let shortfall = 0;

    if (order.pickLines.length === 0) {
      const sold = soldLines(order.items);
      const codes = [...new Set(sold.map((l) => l.skuCode))];
      const skus = await tx.sku.findMany({ where: { code: { in: codes } }, include: { components: true } });
      const byCode = new Map(skus.map((s) => [s.code, s]));
      const missing = codes.filter((c) => !byCode.has(c));
      if (missing.length > 0) {
        throw new InventoryError(`No SKU exists for ${missing.join(", ")} — create it on the Inventory page`);
      }
      const demand = expandDemand(sold.map((l) => ({ sku: byCode.get(l.skuCode)!, quantity: l.quantity })));
      for (const [skuId, quantity] of demand) {
        const r = await allocateSku(tx, orderId, skuId, quantity, actor);
        allocated += r.allocated;
        if (r.shortfall > 0) {
          await tx.pickLine.create({ data: { orderId, skuId, locationId: null, quantity: r.shortfall } });
          shortfall += r.shortfall;
        }
      }
      return { allocated, shortfall };
    }

    for (const line of order.pickLines.filter((l) => l.locationId === null)) {
      const r = await allocateSku(tx, orderId, line.skuId, line.quantity, actor);
      allocated += r.allocated;
      shortfall += r.shortfall;
      if (r.shortfall === 0) await tx.pickLine.delete({ where: { id: line.id } });
      else await tx.pickLine.update({ where: { id: line.id }, data: { quantity: r.shortfall } });
    }
    return { allocated, shortfall };
  });
}

/**
 * Put a cancelled order's stock back where it was taken from, and clear its
 * pick list. A no-op for an order that was never allocated (every order
 * placed while the shop was in legacy mode).
 *
 * Each line is claimed by deleting it BEFORE its stock is credited, and only
 * the call whose delete removed the row gives the stock back. Two cancels
 * racing each other (a double-clicked button) therefore return the stock
 * once, not twice — reading the lines and crediting them all would let both
 * calls credit the same lines.
 */
export async function releaseOrder(orderId: string, actor: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const lines = await tx.pickLine.findMany({ where: { orderId } });
    let returned = 0;
    for (const line of lines) {
      const { count } = await tx.pickLine.deleteMany({ where: { id: line.id } });
      if (count === 0 || !line.locationId) continue;
      await applyMovement(tx, {
        skuId: line.skuId,
        locationId: line.locationId,
        quantity: line.quantity,
        type: "CANCEL",
        reason: "Order cancelled",
        reference: orderId.slice(0, 8),
        orderId,
        actor,
      });
      returned += line.quantity;
    }
    return returned;
  });
}

// ── Storefront readiness ──────────────────────────────────────────

export interface PackReadiness {
  bundleId: string;
  code: string;
  vials: number;
  sku: { id: string; name: string; kind: "kit" | "stocked"; measured: boolean } | null;
  /** Blocks the switch to warehouse mode. */
  problems: string[];
  /** Worth fixing, blocks nothing — label buying will ask for it. */
  warnings: string[];
  available: number;
}

export interface Readiness {
  packs: PackReadiness[];
  locationCount: number;
  ready: boolean;
}

/** Can the shop sell every storefront pack from the warehouse tables? */
export async function inventoryReadiness(): Promise<Readiness> {
  const packs = storefrontSkuCodes();
  const [skus, onHand, locationCount] = await Promise.all([
    prisma.sku.findMany({
      where: { code: { in: packs.map((p) => p.code) } },
      include: { components: { include: { component: true } } },
    }),
    onHandBySku(),
    prisma.location.count({ where: { active: true, warehouse: { active: true } } }),
  ]);
  const byCode = new Map(skus.map((s) => [s.code, s]));

  const rows: PackReadiness[] = packs.map((pack) => {
    const sku = byCode.get(pack.code);
    const problems: string[] = [];
    const warnings: string[] = [];
    if (!sku) {
      return { ...pack, sku: null, problems: ["No SKU with this code"], warnings, available: 0 };
    }
    if (!sku.active) problems.push("SKU is switched off");
    for (const c of sku.components) {
      if (!c.component.active) problems.push(`Component ${c.component.code} is switched off`);
    }
    const measured = sku.weightGrams > 0 && sku.lengthMm > 0 && sku.widthMm > 0 && sku.heightMm > 0;
    if (!measured) warnings.push("Weight or size not set, so no service can be picked for it");
    const available =
      sku.components.length === 0
        ? onHand.get(sku.id) ?? 0
        : kitsAvailable(sku.components.map((c) => ({ quantity: c.quantity, available: onHand.get(c.componentId) ?? 0 })));
    return {
      ...pack,
      sku: { id: sku.id, name: sku.name, kind: sku.components.length > 0 ? "kit" : "stocked", measured },
      problems,
      warnings,
      available,
    };
  });

  return {
    packs: rows,
    locationCount,
    ready: locationCount > 0 && rows.every((r) => r.problems.length === 0),
  };
}

/**
 * One click to a working starting point: the vial as a stocked SKU, and each
 * storefront pack as a kit of that many vials. Creates only what is missing,
 * and never touches a SKU that exists — so a pack that has been changed to a
 * pre-packed SKU of its own stays that way.
 *
 * Packs start unmeasured on purpose. Their weight as posted has to be read
 * off a scale, not multiplied up from a bare vial.
 */
export async function createStorefrontSkus(): Promise<string[]> {
  const product = await prisma.product.findUnique({ where: { slug: "baclab-10ml" } });
  const baseName = `${PRODUCT.name} ${PRODUCT.size}`;
  const created: string[] = [];

  await prisma.$transaction(async (tx) => {
    let vial = await tx.sku.findUnique({ where: { code: VIAL_SKU_CODE } });
    if (!vial) {
      vial = await tx.sku.create({
        data: {
          code: VIAL_SKU_CODE,
          name: baseName,
          description: "The single vial, as it sits on the shelf.",
          weightGrams: product?.weightGrams ?? 0,
        },
      });
      created.push(vial.code);
    }
    for (const pack of storefrontSkuCodes()) {
      if (pack.code === VIAL_SKU_CODE) continue;
      const exists = await tx.sku.findUnique({ where: { code: pack.code } });
      if (exists) continue;
      await tx.sku.create({
        data: {
          code: pack.code,
          name: pack.vials === 1 ? `${baseName} — single` : `${baseName} — ${pack.vials}-pack`,
          description: `Storefront pack "${pack.bundleId}": ${pack.vials} × ${VIAL_SKU_CODE}.`,
          components: { create: [{ componentId: vial.id, quantity: pack.vials }] },
        },
      });
      created.push(pack.code);
    }
  });
  return created;
}
