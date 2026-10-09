"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdmin, requireAdminRole } from "@/lib/adminAuth";
import type { FormState } from "@/lib/form-state";
import { evaluateSizeFormula } from "@/lib/shipping/select-service";
import {
  createShipmentLabel,
  getDeliveryInstructions,
  reconcileShipment,
  ShippingError,
  voidShipment,
} from "@/lib/shipping/shipments";
import { getServices, SmartTrackError, testConnection } from "@/lib/smarttrack/client";
import { cleanDeliveryInstructions, LIMITS } from "@/lib/smarttrack/payload";
import { SETTING_KEYS, writeSetting } from "@/lib/settings";
import { syncTracking, type TrackingSyncResult } from "@/lib/shipping/tracking-sync";
import { closeCatchUpGroup } from "@/lib/shipping/catch-up";
import { deliveryOptionById } from "@/config/funnel";

function message(err: unknown, what: string): FormState {
  if (err instanceof ShippingError) return { error: err.message };
  if (err instanceof SmartTrackError) return { error: err.detail };
  if ((err as { code?: string }).code === "P2002") return { error: "A service with that code already exists" };
  console.error(`[internal] ${what} failed`, err);
  return { error: "Something went wrong" };
}

// SmartTrack sends kg and cm as decimal strings ("3.000", "25.00").
const gramsFromKg = (kg: string | null | undefined) => Math.round((parseFloat(kg ?? "") || 0) * 1000);
const mmFromCm = (cm: string | null | undefined) => Math.round((parseFloat(cm ?? "") || 0) * 10);

// ── Connection and sync ──────────────────────────────────────────

export async function testConnectionAction(_prev: FormState): Promise<FormState> {
  await requireAdminRole("ADMIN");
  try {
    const { env, serviceCount } = await testConnection();
    if (serviceCount === 0) {
      return {
        success: `Connected to SmartTrack ${env.toUpperCase()}: the API key works, but no services are assigned to this account yet. Ask SmartTrack to assign them, then press Sync services.`,
      };
    }
    return { success: `Connected to SmartTrack ${env.toUpperCase()}. ${serviceCount} service(s) on the account.` };
  } catch (err) {
    return message(err, "SmartTrack connection test");
  }
}

/**
 * Pull the account's services from SmartTrack. Limits are overwritten —
 * SmartTrack is the authority on what a service accepts — but the columns
 * that are the operator's call (switched on, priority, volumetric divisor,
 * delivery option) are kept. A service SmartTrack no longer lists is
 * switched off, not deleted, so shipments that used it still read.
 */
export async function syncServicesAction(_prev: FormState): Promise<FormState> {
  await requireAdminRole("ADMIN");
  try {
    const services = await getServices();
    const now = new Date();
    const codes: string[] = [];
    for (const s of services) {
      if (!s.service_code) continue;
      codes.push(s.service_code);
      const limits = {
        name: s.service_name || s.service_code,
        description: s.service_description ?? "",
        source: "SMARTTRACK",
        tracked: s.untracked !== "1",
        minWeightGrams: gramsFromKg(s.from_weight),
        maxWeightGrams: gramsFromKg(s.to_weight),
        maxLengthMm: mmFromCm(s.max_length),
        maxWidthMm: mmFromCm(s.max_width),
        maxHeightMm: mmFromCm(s.max_height),
        sizeFormula: s.maximum_dim_formula ?? "",
        sizeLimitMm: mmFromCm(s.maximum_allowed_dimension),
        deliveryCountries: JSON.stringify(
          (s.delivery_countries ?? []).map((c) => ({
            iso: c.country_iso,
            transitDays: parseInt(c.transit_time, 10) || null,
          }))
        ),
        syncedAt: now,
      };
      await prisma.postalService.upsert({
        where: { code: s.service_code },
        create: { code: s.service_code, ...limits },
        update: limits,
      });
    }
    const { count: retired } = await prisma.postalService.updateMany({
      where: { source: "SMARTTRACK", code: { notIn: codes }, active: true },
      data: { active: false },
    });
    revalidatePath("/admin/shipping");
    return {
      success: `Synced ${codes.length} service(s) from SmartTrack${
        retired > 0 ? `; switched off ${retired} it no longer lists` : ""
      }.`,
    };
  } catch (err) {
    return message(err, "SmartTrack service sync");
  }
}

// ── Services ─────────────────────────────────────────────────────

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const OperatorFields = z.object({
  active: z.boolean(),
  priority: int(0, 9999),
  volumetricDivisor: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1000 && v <= 10000), "Volumetric divisor is usually 4000, 5000 or 6000"),
  deliveryOption: z
    .string()
    .refine((v) => v === "" || deliveryOptionById(v) !== undefined, "Pick a delivery option from the list"),
});

const ManualLimits = z.object({
  name: z.string().trim().min(2, "Give the service a name").max(80),
  description: z.string().trim().max(300),
  carrier: z.string().trim().max(40),
  tracked: z.boolean(),
  minWeightGrams: int(0, 1_000_000),
  maxWeightGrams: int(0, 1_000_000),
  maxLengthMm: int(0, 10_000),
  maxWidthMm: int(0, 10_000),
  maxHeightMm: int(0, 10_000),
  sizeFormula: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || evaluateSizeFormula(v, [3, 2, 1]) !== null, "Size rule not understood — use L, W, H, numbers, + and brackets, e.g. L+2W+2H"),
  sizeLimitMm: int(0, 100_000),
  countries: z
    .string()
    .trim()
    .transform((v) => v.split(/[\s,]+/).filter(Boolean).map((c) => c.toUpperCase()))
    .refine((list) => list.every((c) => /^[A-Z]{2}$/.test(c)), "Countries are two-letter codes separated by commas, e.g. GB, IE"),
});

/**
 * Save a service. SmartTrack-sourced rows only take the operator's columns;
 * their limits come from the sync. Manual rows take everything.
 */
export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const operator = OperatorFields.safeParse({
    active: formData.get("active") === "on",
    priority: formData.get("priority") || 100,
    volumetricDivisor: String(formData.get("volumetricDivisor") ?? ""),
    deliveryOption: String(formData.get("deliveryOption") ?? ""),
  });
  if (!operator.success) return { error: operator.error.errors[0]?.message ?? "Check the service details" };

  const serviceId = String(formData.get("serviceId") ?? "");
  const existing = serviceId ? await prisma.postalService.findUnique({ where: { id: serviceId } }) : null;
  if (serviceId && !existing) return { error: "Service not found" };

  try {
    if (existing?.source === "SMARTTRACK") {
      await prisma.postalService.update({ where: { id: existing.id }, data: operator.data });
    } else {
      const limits = ManualLimits.safeParse({
        name: formData.get("name") ?? "",
        description: formData.get("description") ?? "",
        carrier: formData.get("carrier") ?? "",
        tracked: formData.get("tracked") === "on",
        minWeightGrams: formData.get("minWeightGrams") || 0,
        maxWeightGrams: formData.get("maxWeightGrams") || 0,
        maxLengthMm: formData.get("maxLengthMm") || 0,
        maxWidthMm: formData.get("maxWidthMm") || 0,
        maxHeightMm: formData.get("maxHeightMm") || 0,
        sizeFormula: formData.get("sizeFormula") ?? "",
        sizeLimitMm: formData.get("sizeLimitMm") || 0,
        countries: formData.get("countries") ?? "",
      });
      if (!limits.success) return { error: limits.error.errors[0]?.message ?? "Check the service limits" };
      const { countries, ...rest } = limits.data;
      if (rest.maxWeightGrams > 0 && rest.minWeightGrams > rest.maxWeightGrams) {
        return { error: "The minimum weight is above the maximum" };
      }
      const data = {
        ...rest,
        ...operator.data,
        source: "MANUAL",
        deliveryCountries: JSON.stringify(countries.map((iso) => ({ iso, transitDays: null }))),
      };
      if (existing) {
        await prisma.postalService.update({ where: { id: existing.id }, data });
      } else {
        const code = String(formData.get("code") ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return { error: "A service code is 2–40 letters, digits, dashes or underscores" };
        await prisma.postalService.create({ data: { ...data, code } });
      }
    }
  } catch (err) {
    return message(err, "save service");
  }
  revalidatePath("/admin/shipping");
  return { success: "Service saved." };
}

// ── Delivery instructions ────────────────────────────────────────

export async function saveDeliveryInstructionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const text = String(formData.get("deliveryInstructions") ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { error: "SmartTrack requires something here — e.g. “Leave at doorstep”" };
  if (text.length > LIMITS.description) {
    return { error: `SmartTrack allows ${LIMITS.description} characters; that is ${text.length}` };
  }
  await writeSetting(SETTING_KEYS.deliveryInstructions, text);
  revalidatePath("/admin/shipping");
  return { success: "Saved. Labels for orders without their own instructions carry it." };
}

// ── Automatic labels ─────────────────────────────────────────────

export async function saveAutoLabelsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const on = formData.get("autoLabels") === "on";
  await writeSetting(SETTING_KEYS.autoLabels, on ? "on" : "off");
  revalidatePath("/admin/shipping");
  return {
    success: on
      ? "Saved. Labels are bought as soon as an order is paid."
      : "Saved. Labels are only bought from the order page.",
  };
}

// ── Tracking ─────────────────────────────────────────────────────

export async function saveTrackingUpdatesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const on = formData.get("trackingUpdates") === "on";
  await writeSetting(SETTING_KEYS.trackingUpdates, on ? "on" : "off");
  revalidatePath("/admin/shipping");
  return {
    success: on
      ? "Saved. Orders move to shipped and delivered from SmartTrack tracking."
      : "Saved. Orders only move on when marked by hand.",
  };
}

function describeSync(r: TrackingSyncResult): string {
  const parts = [`${r.checked} label${r.checked === 1 ? "" : "s"} checked`];
  if (r.shipped) parts.push(`${r.shipped} moved to shipped`);
  if (r.delivered) parts.push(`${r.delivered} moved to delivered`);
  if (r.problems) parts.push(`${r.problems} with a delivery problem`);
  if (r.errors) parts.push(`${r.errors} could not be checked`);
  return parts.join(", ");
}

/** One label, now. Packers too: it is on the order page. */
export async function checkTrackingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  try {
    // A moment ahead, so a label checked a second ago is still checked again.
    const r = await syncTracking({ shipmentId, staleBefore: new Date(Date.now() + 1000) });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    if (!r.ran) return { error: `Tracking is not running: ${r.reason}.` };
    if (r.errors) return { error: r.reason ?? "SmartTrack could not be asked. Try again in a minute." };
    if (r.checked === 0) return { error: "This label is not one tracking follows (it has no tracking number, or the order is closed)." };
    if (r.delivered) return { success: "Delivered — the order is now marked delivered." };
    if (r.shipped) return { success: "The carrier has it — the order is now marked shipped." };
    return { success: "Checked. Nothing new." };
  } catch (err) {
    return message(err, "check tracking");
  }
}

/**
 * One batch of the catch-up's tracking check. Each press checks for about a
 * minute — the Cloudflare proxy gives up on a request after 100 seconds.
 * A label checked in the last hour (by an earlier press, or the cron) is
 * not checked again, so "Continue" moves on to the rest.
 */
export async function catchUpTrackingAction(_prev: FormState): Promise<FormState> {
  await requireAdminRole("ADMIN");
  try {
    const r = await syncTracking({ budgetMs: 60_000, limit: 500 });
    revalidatePath("/admin/shipping/catch-up");
    revalidatePath("/admin");
    if (!r.ran) return { error: `Tracking is not running: ${r.reason}.` };
    const summary = describeSync(r);
    if (r.reason) return { error: `${summary}. Stopped: ${r.reason}` };
    return {
      success:
        r.remaining > 0
          ? `${summary}. ${r.remaining} still to check — press Continue.`
          : `${summary}. Every label has been checked.`,
    };
  } catch (err) {
    return message(err, "catch-up tracking");
  }
}

// Not "notScanned": a label the carrier never scanned is not a delivery (lib/shipping/catch-up.ts).
const catchUpGroupField = z.enum(["noLabel", "labelFailed"]);

export async function closeCatchUpGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const group = catchUpGroupField.safeParse(formData.get("group"));
  if (!group.success) return { error: "Unknown group" };
  try {
    const moved = await closeCatchUpGroup(group.data);
    revalidatePath("/admin/shipping/catch-up");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { success: `${moved} order${moved === 1 ? "" : "s"} marked delivered. No emails were sent.` };
  } catch (err) {
    return message(err, "close catch-up group");
  }
}

// ── Labels (packers too) ─────────────────────────────────────────

const orderIdField = z.string().uuid();

export async function createLabelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const orderId = orderIdField.safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Order not found" };
  const serviceCode = String(formData.get("serviceCode") ?? "").trim() || null;
  try {
    // What is in the box goes on the label, and stays with the order.
    if (formData.has("deliveryInstructions")) {
      const typed = cleanDeliveryInstructions(formData.get("deliveryInstructions"));
      const fallback = await getDeliveryInstructions();
      await prisma.order.update({
        where: { id: orderId.data },
        data: { deliveryInstructions: typed && typed !== fallback ? typed : null },
      });
    }
    const session = await getAdminSession();
    const { warnings, packed } = await createShipmentLabel({
      orderId: orderId.data,
      serviceCode,
      actor: session?.adminUserId ?? "admin",
    });
    revalidatePath(`/admin/orders/${orderId.data}`);
    revalidatePath("/admin/orders");
    return {
      success: `Label bought${packed ? " and the order marked packed" : ""}.${
        warnings.length ? ` Note: ${warnings.join("; ")}.` : ""
      }`,
    };
  } catch (err) {
    revalidatePath(`/admin/orders/${orderId.data}`);
    return message(err, "create label");
  }
}

export async function voidShipmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  try {
    await voidShipment(shipmentId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { success: "Label voided." };
  } catch (err) {
    return message(err, "void label");
  }
}

export async function reconcileShipmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  try {
    const outcome = await reconcileShipment(shipmentId);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return outcome === "CREATED"
      ? { success: "SmartTrack has the label — it was bought, and is now stored here." }
      : { success: "SmartTrack has no such label, so nothing was bought. You can buy one now." };
  } catch (err) {
    return message(err, "reconcile label");
  }
}
