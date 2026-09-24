import { prisma } from "@/lib/db";
import { parseAddress } from "@/lib/orderAddress";
import { readSetting, SETTING_KEYS } from "@/lib/settings";
import { planOrderShipment } from "@/lib/shipping/order-parcel";
import { smartTrackConfig } from "@/lib/smarttrack/config";
import {
  generateLabel,
  getLabel,
  SmartTrackAuthError,
  SmartTrackError,
  SmartTrackNotConfiguredError,
  voidLabels,
} from "@/lib/smarttrack/client";
import { buildShipmentRequest } from "@/lib/smarttrack/payload";

/**
 * Buying, fetching and voiding carrier labels for an order.
 *
 * A label costs money the moment SmartTrack says "created", so the Shipment
 * row is written as PENDING *before* the call and updated after it. If the
 * process dies in between, or the call times out, the order page shows a
 * PENDING label with a "Check with SmartTrack" button (reconcileShipment),
 * which asks SmartTrack whether that reference exists — rather than the
 * label being bought, lost, and bought again.
 *
 * One active label per order (PENDING or CREATED). Replacing one means
 * voiding it first, and every attempt gets its own reference, so SmartTrack
 * never sees a reused order_reference.
 */

/** Something the operator can fix, worded for them. */
export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingError";
  }
}

const ACTIVE = ["PENDING", "CREATED"];

/**
 * The delivery instructions sent with every label, in SmartTrack's
 * `description` field. Set on the Shipping page; this is what applies until
 * someone changes it.
 */
export const DEFAULT_DELIVERY_INSTRUCTIONS = "Leave at doorstep";

export async function getDeliveryInstructions(): Promise<string> {
  return (await readSetting(SETTING_KEYS.deliveryInstructions))?.trim() || DEFAULT_DELIVERY_INSTRUCTIONS;
}

/**
 * Nothing happened on SmartTrack's side: either signing in failed, so the
 * request was never sent, or SmartTrack answered it and said no. A network
 * failure (status 0) or a 5xx on the request itself leaves the outcome
 * unknown, and is not this.
 */
function isRefusal(err: unknown): err is SmartTrackError {
  if (err instanceof SmartTrackAuthError) return true;
  return err instanceof SmartTrackError && err.httpStatus > 0 && err.httpStatus < 500;
}

export function parseTrackingNumbers(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/** The label PDF as base64: SmartTrack's inline copy, else downloaded from its URL. */
async function labelBase64(data: {
  label_bin_str?: string;
  label_url?: string;
  label?: string;
  parcel_label?: { label_bin_string?: string }[];
}): Promise<string | null> {
  const inline = data.label_bin_str || data.parcel_label?.[0]?.label_bin_string;
  if (inline) return inline;
  const url = data.label_url || data.label;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export async function createShipmentLabel(input: {
  orderId: string;
  /** A service picked on the order page, overriding the automatic choice. */
  serviceCode?: string | null;
  actor: string;
}): Promise<{ shipmentId: string; warnings: string[] }> {
  const cfg = smartTrackConfig();
  if (!cfg) throw new SmartTrackNotConfiguredError();

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      shipments: true,
      pickLines: { include: { location: { include: { warehouse: true } } } },
    },
  });
  if (!order) throw new ShippingError("Order not found");
  if (!["paid", "packed"].includes(order.status)) {
    throw new ShippingError(`A ${order.status} order cannot have a label bought for it`);
  }
  if (order.shipments.some((s) => ACTIVE.includes(s.status))) {
    throw new ShippingError("This order already has a label. Void it first to buy another.");
  }

  const address = parseAddress(order);
  if (!address?.line1) throw new ShippingError("The order has no delivery address yet");

  const plan = await planOrderShipment(order);
  if (plan.missingSkus.length > 0) {
    throw new ShippingError(`No SKU exists for ${plan.missingSkus.join(", ")} — create it on the Inventory page`);
  }

  let service;
  let choice: string;
  if (input.serviceCode) {
    service = plan.services.find((s) => s.code === input.serviceCode && s.active);
    if (!service) throw new ShippingError(`Service ${input.serviceCode} is not available`);
    choice = "manual";
  } else {
    const picked = plan.selection.service;
    if (!picked) throw new ShippingError(plan.selection.note);
    service = plan.services.find((s) => s.code === picked.code)!;
    choice = plan.selection.choice ?? "auto";
  }

  // The label's sender is the warehouse the stock was picked from; before
  // allocation exists (legacy mode) it is the first warehouse set up.
  const warehouse =
    order.pickLines.find((l) => l.location)?.location?.warehouse ??
    (await prisma.warehouse.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }));
  if (!warehouse) throw new ShippingError("Add a warehouse, with its address, on the Inventory page first");

  const reference = `${order.id}-${order.shipments.length + 1}`;
  const built = buildShipmentRequest({
    reference,
    orderRef: order.id.slice(0, 8).toUpperCase(),
    serviceCode: service.code,
    labelSize: cfg.labelSize,
    sender: warehouse,
    receiver: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      address,
    },
    parcel: plan.parcel,
    items: plan.lines.map((l) => ({
      skuCode: l.sold.skuCode,
      description: l.sku?.name ?? l.sold.description,
      quantity: l.sold.quantity,
      unitWeightGrams: l.sku?.weightGrams ?? 0,
      lineTotalMinor: l.sold.lineTotalMinor,
      hsCode: l.sku?.hsCode,
      originCountryIso: l.sku?.originCountryIso,
    })),
    goodsTotalMinor: Math.round(Number(order.totalAmount) * 100),
    currency: order.currency,
    // The customer's own, else the shop's default.
    deliveryInstructions: order.deliveryInstructions?.trim() || (await getDeliveryInstructions()),
  });
  if (!built.request) throw new ShippingError(built.problems.join(". "));

  // Two clicks racing here compute the same reference; the unique index lets
  // one through and stops the other before SmartTrack is ever called.
  const shipment = await prisma.shipment
    .create({
      data: {
        orderId: order.id,
        reference,
        environment: cfg.env,
        status: "PENDING",
        serviceCode: service.code,
        serviceName: service.name,
        serviceChoice: choice,
        weightGrams: plan.parcel.weightGrams,
        lengthMm: plan.parcel.lengthMm,
        widthMm: plan.parcel.widthMm,
        heightMm: plan.parcel.heightMm,
        actor: input.actor,
      },
    })
    .catch((err: unknown) => {
      if ((err as { code?: string }).code === "P2002") {
        throw new ShippingError("A label is already being bought for this order. Refresh the page.");
      }
      throw err;
    });

  try {
    const data = await generateLabel(built.request);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "CREATED",
        carrierShipmentId: data.id != null ? String(data.id) : null,
        trackingNumbers: JSON.stringify(data.tracking_number ?? []),
        labelPdf: await labelBase64(data),
      },
    });
  } catch (err) {
    if (isRefusal(err)) {
      await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "FAILED", error: err.detail } });
      throw new ShippingError(`No label was bought: ${err.detail}`);
    }
    // Unknown outcome: stays PENDING for reconcileShipment to settle.
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    throw new ShippingError(
      "No clear answer from SmartTrack, so it is not known whether the label was bought. Use “Check with SmartTrack” on the order page before trying again."
    );
  }

  return { shipmentId: shipment.id, warnings: built.warnings };
}

function sameEnvironment(shipment: { environment: string }) {
  const cfg = smartTrackConfig();
  if (!cfg) throw new SmartTrackNotConfiguredError();
  if (cfg.env !== shipment.environment) {
    throw new ShippingError(
      `This label was made in SmartTrack ${shipment.environment.toUpperCase()}, but the site is connected to ${cfg.env.toUpperCase()}.`
    );
  }
  return cfg;
}

/**
 * Settle a PENDING shipment: if SmartTrack has a label under its reference,
 * it was bought — store it; if SmartTrack says it has none, it never was.
 */
export async function reconcileShipment(shipmentId: string): Promise<"CREATED" | "FAILED"> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new ShippingError("Shipment not found");
  if (shipment.status !== "PENDING") throw new ShippingError("Only a pending label needs checking");
  const cfg = sameEnvironment(shipment);

  try {
    const data = await getLabel(shipment.reference, cfg.labelSize);
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "CREATED",
        trackingNumbers: JSON.stringify(data.tracking_number ?? []),
        labelPdf: await labelBase64(data),
        error: null,
      },
    });
    return "CREATED";
  } catch (err) {
    // Could not sign in, so SmartTrack was never asked: that says nothing
    // about whether the label exists.
    if (err instanceof SmartTrackAuthError) throw new ShippingError(err.detail);
    if (isRefusal(err)) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: "FAILED", error: `Not found at SmartTrack: ${err.detail}` },
      });
      return "FAILED";
    }
    throw new ShippingError("Still no clear answer from SmartTrack. Try again in a minute.");
  }
}

export async function voidShipment(shipmentId: string): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new ShippingError("Shipment not found");
  if (shipment.status !== "CREATED") {
    throw new ShippingError(`A ${shipment.status.toLowerCase()} label cannot be voided`);
  }
  sameEnvironment(shipment);
  try {
    await voidLabels([shipment.reference]);
  } catch (err) {
    if (err instanceof SmartTrackError) throw new ShippingError(`SmartTrack would not void it: ${err.detail}`);
    throw err;
  }
  await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "VOIDED", voidedAt: new Date() } });
}

/** The label as PDF bytes, fetched again from SmartTrack if it was not stored. */
export async function shipmentLabelPdf(shipmentId: string): Promise<Buffer | null> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment || shipment.status !== "CREATED") return null;
  if (shipment.labelPdf) return Buffer.from(shipment.labelPdf, "base64");

  const cfg = sameEnvironment(shipment);
  const pdf = await labelBase64(await getLabel(shipment.reference, cfg.labelSize));
  if (!pdf) return null;
  await prisma.shipment.update({ where: { id: shipment.id }, data: { labelPdf: pdf } });
  return Buffer.from(pdf, "base64");
}
