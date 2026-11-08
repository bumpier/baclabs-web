import type { Order, PostalService, Sku } from "@prisma/client";
import { prisma } from "@/lib/db";
import { soldLines, type SoldLine } from "@/lib/inventory/demand";
import { parseAddress } from "@/lib/orderAddress";
import { combineUnits, type Parcel } from "@/lib/shipping/parcel";
import { selectService, toServiceRule, type ServiceSelection } from "@/lib/shipping/select-service";
import { parseStandardParcel, usesStandardParcel, type StandardParcel } from "@/lib/shipping/standard-parcel";
import { readSetting, SETTING_KEYS } from "@/lib/settings";

/** The one box every order goes in, as set on the Shipping page. */
export async function getStandardParcel(): Promise<StandardParcel> {
  return parseStandardParcel(await readSetting(SETTING_KEYS.standardParcel));
}

/**
 * What an order will go out as: its SKUs, the parcel they make, and the
 * service that parcel needs — among those linked to the delivery option the
 * customer paid for. Read-only — the order page shows it, and label
 * buying (lib/shipping/shipments.ts) acts on it.
 *
 * The parcel is built from the SKUs as SOLD, not the vials on the shelf: a
 * 5-pack goes in the post as the 5-pack's box, so it is the 5-pack SKU's
 * weight and size that count. That is why every sellable SKU, kits
 * included, carries its own measurements.
 */
export interface ShipmentPlan {
  lines: { sold: SoldLine; sku: Sku | null }[];
  /** Codes on the order with no SKU. Blocks a label. */
  missingSkus: string[];
  parcel: Parcel;
  /** The parcel is the standard box, not one sized from the SKUs. */
  standardParcel: boolean;
  countryIso: string;
  selection: ServiceSelection;
  /** Every service on file, for the manual override list. */
  services: PostalService[];
}

export function skuParcel(sku: Pick<Sku, "weightGrams" | "lengthMm" | "widthMm" | "heightMm">): Parcel {
  return {
    weightGrams: sku.weightGrams,
    lengthMm: sku.lengthMm,
    widthMm: sku.widthMm,
    heightMm: sku.heightMm,
  };
}

/**
 * The service assigned by hand, when every SKU on the order agrees on one.
 * Two SKUs assigned different services have no single answer, so that order
 * is worked out from its parcel instead.
 */
function assignedService(skus: (Sku | null)[]): string | null {
  const codes = new Set(skus.map((s) => s?.serviceCode ?? null));
  if (codes.size !== 1) return null;
  return [...codes][0] ?? null;
}

export async function planOrderShipment(order: Order): Promise<ShipmentPlan> {
  const sold = soldLines(order.items);
  const codes = [...new Set(sold.map((l) => l.skuCode))];
  const [skus, services, standard] = await Promise.all([
    prisma.sku.findMany({ where: { code: { in: codes } } }),
    prisma.postalService.findMany({ orderBy: [{ priority: "asc" }, { name: "asc" }] }),
    getStandardParcel(),
  ]);
  const byCode = new Map(skus.map((s) => [s.code, s]));
  const lines = sold.map((l) => ({ sold: l, sku: byCode.get(l.skuCode) ?? null }));
  const missingSkus = codes.filter((c) => !byCode.has(c));

  // Every order goes in the standard box unless a SKU on it needs its own;
  // only then do the SKUs' measurements decide the parcel.
  const standardParcel = usesStandardParcel(codes, standard);
  const parcel: Parcel = standardParcel
    ? { ...standard.parcel }
    : missingSkus.length > 0
      ? { weightGrams: 0, lengthMm: 0, widthMm: 0, heightMm: 0 }
      : combineUnits(lines.map((l) => ({ parcel: skuParcel(l.sku!), quantity: l.sold.quantity })));

  const countryIso = (parseAddress(order)?.country || "GB").toUpperCase();
  const selection = selectService(
    services.map(toServiceRule),
    parcel,
    countryIso,
    assignedService(lines.map((l) => l.sku)),
    order.deliveryOption
  );

  return { lines, missingSkus, parcel, standardParcel, countryIso, selection, services };
}
