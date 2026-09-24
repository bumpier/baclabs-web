"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import type { FormState } from "@/lib/form-state";
import {
  ADJUST_REASONS,
  locationCodeError,
  normaliseCode,
  skuCodeError,
  warehouseCodeError,
} from "@/lib/inventory/codes";
import { setInventoryMode } from "@/lib/inventory/mode";
import { SUPPLIER_PACK_VIALS, VIAL_SKU_CODE } from "@/lib/inventory/demand";
import {
  adjustStock,
  allocateOrder,
  createStorefrontSkus,
  InventoryError,
  inventoryReadiness,
  receiveStock,
  transferStock,
} from "@/lib/inventory/store";

/** Who did it, for the ledger: the AdminUser, or "admin" for the env login. */
async function actor(): Promise<string> {
  const session = await getAdminSession();
  return session?.adminUserId ?? "admin";
}

function message(err: unknown, fallback: string): FormState {
  if (err instanceof InventoryError) return { error: err.message };
  if ((err as { code?: string }).code === "P2002") return { error: "That code or barcode is already in use" };
  console.error(`[internal] ${fallback}`, err);
  return { error: "Something went wrong" };
}

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

// ── SKUs ─────────────────────────────────────────────────────────

const SkuSchema = z.object({
  name: z.string().trim().min(2, "Give the SKU a name").max(120),
  description: z.string().trim().max(1000),
  barcode: optionalText(64).refine((v) => v === null || /^[A-Za-z0-9-]+$/.test(v), "A barcode is letters, digits and dashes only"),
  weightGrams: int(0, 100_000),
  lengthMm: int(0, 5_000),
  widthMm: int(0, 5_000),
  heightMm: int(0, 5_000),
  hsCode: optionalText(14).refine((v) => v === null || /^[0-9.]+$/.test(v), "An HS code is digits (and dots) only"),
  originCountryIso: optionalText(2).refine((v) => v === null || /^[A-Za-z]{2}$/.test(v), "Country of origin is a two-letter code, e.g. GB"),
  serviceCode: optionalText(40),
  active: z.boolean(),
});

/**
 * Create or update a SKU and its kit components. The code is fixed once the
 * SKU exists: it is printed on shelf labels and matched against the
 * storefront's pack codes, so renaming it would quietly break both.
 */
export async function saveSkuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const parsed = SkuSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    barcode: formData.get("barcode") ?? "",
    weightGrams: formData.get("weightGrams") || 0,
    lengthMm: formData.get("lengthMm") || 0,
    widthMm: formData.get("widthMm") || 0,
    heightMm: formData.get("heightMm") || 0,
    hsCode: formData.get("hsCode") ?? "",
    originCountryIso: formData.get("originCountryIso") ?? "",
    serviceCode: formData.get("serviceCode") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Check the SKU details" };
  const d = parsed.data;

  const skuId = typeof formData.get("skuId") === "string" ? String(formData.get("skuId")) : "";
  const existing = skuId ? await prisma.sku.findUnique({ where: { id: skuId } }) : null;
  if (skuId && !existing) return { error: "SKU not found" };

  const code = existing ? existing.code : normaliseCode(String(formData.get("code") ?? ""));
  const codeError = skuCodeError(code);
  if (codeError) return { error: codeError };

  if (d.serviceCode && !(await prisma.postalService.findUnique({ where: { code: d.serviceCode } }))) {
    return { error: "That postal service is not on the Shipping page" };
  }

  // Components arrive as parallel lists from the kit rows.
  const componentIds = formData.getAll("componentSkuId").map(String);
  const componentQtys = formData.getAll("componentQty").map((v) => Number(v));
  const components: { componentId: string; quantity: number }[] = [];
  for (let i = 0; i < componentIds.length; i++) {
    const id = componentIds[i]!;
    if (!id) continue;
    const qty = componentQtys[i] ?? 0;
    if (!Number.isInteger(qty) || qty < 1 || qty > 10_000) return { error: "Each component needs a whole-number quantity of at least 1" };
    if (id === existing?.id) return { error: "A SKU cannot be a component of itself" };
    if (components.some((c) => c.componentId === id)) return { error: "Each component can only be listed once" };
    components.push({ componentId: id, quantity: qty });
  }

  if (components.length > 0) {
    const parts = await prisma.sku.findMany({
      where: { id: { in: components.map((c) => c.componentId) } },
      include: { components: true },
    });
    if (parts.length !== components.length) return { error: "A component SKU no longer exists" };
    const nested = parts.find((p) => p.components.length > 0);
    if (nested) return { error: `${nested.code} is itself a kit. Components must be SKUs that sit on a shelf.` };
    if (existing) {
      const [stocked, usedIn] = await Promise.all([
        prisma.stockLevel.aggregate({ where: { skuId: existing.id }, _sum: { quantity: true } }),
        prisma.skuComponent.count({ where: { componentId: existing.id } }),
      ]);
      if ((stocked._sum.quantity ?? 0) > 0) {
        return { error: `${code} has stock on the shelves, and a kit holds none. Adjust it to zero before making it a kit.` };
      }
      if (usedIn > 0) return { error: `${code} is a component of another kit, so it cannot be a kit itself.` };
    }
  }

  const data = {
    name: d.name,
    description: d.description,
    barcode: d.barcode,
    weightGrams: d.weightGrams,
    lengthMm: d.lengthMm,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    hsCode: d.hsCode,
    originCountryIso: d.originCountryIso?.toUpperCase() ?? null,
    serviceCode: d.serviceCode,
    active: d.active,
  };

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.skuComponent.deleteMany({ where: { kitId: existing.id } });
        await tx.sku.update({
          where: { id: existing.id },
          data: { ...data, components: { create: components } },
        });
        return existing.id;
      }
      const created = await tx.sku.create({ data: { ...data, code, components: { create: components } } });
      return created.id;
    });
  } catch (err) {
    return message(err, "save SKU failed");
  }

  revalidatePath("/admin/inventory");
  redirect(`/admin/inventory/skus/${id}?saved=1`);
}

export async function createStorefrontSkusAction(_prev: FormState): Promise<FormState> {
  await requireAdminRole("ADMIN");
  try {
    const created = await createStorefrontSkus();
    revalidatePath("/admin/inventory");
    return created.length === 0
      ? { success: "Every storefront pack already has a SKU." }
      : { success: `Created ${created.join(", ")}. Weigh and measure each pack as it goes in the post, then enter it on the SKU.` };
  } catch (err) {
    return message(err, "create storefront SKUs failed");
  }
}

// ── Inventory mode ───────────────────────────────────────────────

export async function setInventoryModeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const mode = formData.get("mode") === "warehouse" ? "warehouse" : "legacy";
  if (mode === "warehouse") {
    const readiness = await inventoryReadiness();
    if (!readiness.ready) return { error: "Not every storefront pack is ready yet — see the checklist." };
  }
  await setInventoryMode(mode);
  revalidatePath("/admin/inventory");
  return {
    success:
      mode === "warehouse"
        ? "Checkout now sells against the shelves, and paid orders are allocated to locations."
        : "Checkout is back on the old single stock counter.",
  };
}

// ── Warehouses and locations ─────────────────────────────────────

const WarehouseSchema = z.object({
  name: z.string().trim().min(2, "Give the warehouse a name").max(80),
  contactName: z.string().trim().max(40),
  company: z.string().trim().max(25),
  addressLine1: z.string().trim().max(60),
  addressLine2: z.string().trim().max(60),
  city: z.string().trim().max(25),
  postcode: z.string().trim().max(10),
  countryIso: z.string().trim().regex(/^[A-Za-z]{2}$/, "Country is a two-letter code, e.g. GB"),
  phone: z.string().trim().max(17),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(45)]),
  active: z.boolean(),
});

export async function saveWarehouseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const parsed = WarehouseSchema.safeParse({
    name: formData.get("name") ?? "",
    contactName: formData.get("contactName") ?? "",
    company: formData.get("company") ?? "",
    addressLine1: formData.get("addressLine1") ?? "",
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city") ?? "",
    postcode: formData.get("postcode") ?? "",
    countryIso: formData.get("countryIso") || "GB",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Check the warehouse details" };
  const data = { ...parsed.data, countryIso: parsed.data.countryIso.toUpperCase() };

  const warehouseId = String(formData.get("warehouseId") ?? "");
  try {
    if (warehouseId) {
      await prisma.warehouse.update({ where: { id: warehouseId }, data });
    } else {
      const code = normaliseCode(String(formData.get("code") ?? ""));
      const err = warehouseCodeError(code);
      if (err) return { error: err };
      await prisma.warehouse.create({ data: { ...data, code } });
    }
  } catch (err) {
    return message(err, "save warehouse failed");
  }
  revalidatePath("/admin/inventory/warehouses");
  return { success: "Warehouse saved." };
}

export async function saveLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const pickSequence = Number(formData.get("pickSequence") || 100);
  if (!Number.isInteger(pickSequence) || pickSequence < 0 || pickSequence > 9999) {
    return { error: "Pick order is a whole number from 0 to 9999" };
  }
  const locationId = String(formData.get("locationId") ?? "");
  try {
    if (locationId) {
      await prisma.location.update({
        where: { id: locationId },
        data: { pickSequence, active: formData.get("active") === "on" },
      });
    } else {
      const warehouseId = String(formData.get("warehouseId") ?? "");
      if (!(await prisma.warehouse.findUnique({ where: { id: warehouseId } }))) return { error: "Warehouse not found" };
      const code = normaliseCode(String(formData.get("code") ?? ""));
      const err = locationCodeError(code);
      if (err) return { error: err };
      await prisma.location.create({ data: { warehouseId, code, pickSequence } });
    }
  } catch (err) {
    return message(err, "save location failed");
  }
  revalidatePath("/admin/inventory/warehouses");
  return { success: "Location saved." };
}

// ── Stock movements ──────────────────────────────────────────────

export async function stockMovementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const type = String(formData.get("type") ?? "");
  const skuId = String(formData.get("skuId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80);
  if (!skuId) return { error: "Pick a SKU" };
  if (!locationId) return { error: "Pick a location" };

  try {
    const who = await actor();
    if (type === "receive") {
      // Vials arrive in the supplier's packs; the shelf is counted in vials.
      if (formData.get("unit") === "supplierPack") {
        const sku = await prisma.sku.findUnique({ where: { id: skuId } });
        if (sku?.code !== VIAL_SKU_CODE) return { error: "Supplier packs can only be booked in as single vials" };
        if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Enter how many packs arrived" };
        const packs = `${quantity} × pack of ${SUPPLIER_PACK_VIALS}`;
        await receiveStock({
          skuId,
          locationId,
          quantity: quantity * SUPPLIER_PACK_VIALS,
          reference: (reference ? `${reference} · ${packs}` : packs).slice(0, 80),
          actor: who,
        });
      } else {
        await receiveStock({ skuId, locationId, quantity, reference, actor: who });
      }
    } else if (type === "adjust") {
      const reason = String(formData.get("reason") ?? "");
      if (!(ADJUST_REASONS as readonly string[]).includes(reason)) return { error: "Pick a reason for the adjustment" };
      const note = String(formData.get("note") ?? "").trim().slice(0, 200);
      if (reason === "Other" && !note) return { error: "Say what the adjustment is for" };
      await adjustStock({
        skuId,
        locationId,
        delta: quantity,
        reason: note ? `${reason}: ${note}` : reason,
        reference,
        actor: who,
      });
    } else if (type === "transfer") {
      const toLocationId = String(formData.get("toLocationId") ?? "");
      if (!toLocationId) return { error: "Pick where the stock is going" };
      await transferStock({ skuId, fromLocationId: locationId, toLocationId, quantity, actor: who });
    } else {
      return { error: "Pick receive, adjust or transfer" };
    }
  } catch (err) {
    return message(err, "stock movement failed");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/stock");
  return { success: "Stock updated." };
}

// ── Orders ───────────────────────────────────────────────────────

/** Allocate, or retry the shortfall on, a paid order. See allocateOrder. */
export async function allocateOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const orderId = z.string().uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Order not found" };
  try {
    const { allocated, shortfall } = await allocateOrder(orderId.data, await actor());
    revalidatePath(`/admin/orders/${orderId.data}`);
    if (shortfall > 0) return { error: `Allocated ${allocated}; still ${shortfall} short. Book stock in, then try again.` };
    return { success: allocated > 0 ? `Allocated ${allocated} unit(s).` : "Nothing left to allocate." };
  } catch (err) {
    return message(err, "allocate order failed");
  }
}
