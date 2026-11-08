import { normaliseCode } from "@/lib/inventory/codes";
import { declaredGrams, type Parcel } from "@/lib/shipping/parcel";

/**
 * One box for every order. Whatever a customer orders goes out in the same
 * small parcel, so the label states that box — its size and its weight —
 * instead of a parcel worked out by stacking each SKU's measurements.
 *
 * WHY. Order 13032f6f (two vials, 110 g) reached Royal Mail declared at
 * 20 kg: the "declare the service's maximum" rule (lib/shipping/parcel.ts)
 * was written for Amazon's 2 kg band, and Royal Mail Tracked 48 syncs from
 * SmartTrack with a 20 kg one. Royal Mail refused it ("Not Match Product").
 * Other orders failed because their SKUs had no size on file.
 *
 * The default, 45 × 35 × 16 cm and 2 kg, is Royal Mail's Small Parcel, so
 * Standard (Royal Mail) and Next day (Amazon) labels describe the same box.
 * A SKU listed in ownBoxSkus does not fit it: an order holding one is sized
 * from its SKUs as before. Pure — no database — so the tests can run it.
 */
export interface StandardParcel {
  /** Off: every order is sized from its SKUs. */
  on: boolean;
  parcel: Parcel;
  /** SKU codes, upper case, that need a box of their own. */
  ownBoxSkus: string[];
}

export const DEFAULT_STANDARD_PARCEL: StandardParcel = {
  on: true,
  parcel: { weightGrams: 2000, lengthMm: 450, widthMm: 350, heightMm: 160 },
  ownBoxSkus: [],
};

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

/** The stored setting, or the default for anything missing or nonsense. */
export function parseStandardParcel(raw: string | null): StandardParcel {
  let stored: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") stored = parsed as Record<string, unknown>;
    } catch {
      // Unreadable: the default below.
    }
  }
  const d = DEFAULT_STANDARD_PARCEL;
  return {
    on: typeof stored.on === "boolean" ? stored.on : d.on,
    parcel: {
      weightGrams: positiveInt(stored.weightGrams, d.parcel.weightGrams),
      lengthMm: positiveInt(stored.lengthMm, d.parcel.lengthMm),
      widthMm: positiveInt(stored.widthMm, d.parcel.widthMm),
      heightMm: positiveInt(stored.heightMm, d.parcel.heightMm),
    },
    ownBoxSkus: Array.isArray(stored.ownBoxSkus)
      ? stored.ownBoxSkus.filter((c): c is string => typeof c === "string").map(normaliseCode).filter(Boolean)
      : [...d.ownBoxSkus],
  };
}

export function serializeStandardParcel(s: StandardParcel): string {
  return JSON.stringify({ on: s.on, ...s.parcel, ownBoxSkus: s.ownBoxSkus });
}

/** Whether an order holding these SKU codes goes in the standard parcel. */
export function usesStandardParcel(skuCodes: readonly string[], standard: StandardParcel): boolean {
  if (!standard.on) return false;
  const listed = new Set(standard.ownBoxSkus.map(normaliseCode));
  return !skuCodes.some((c) => listed.has(normaliseCode(c)));
}

/**
 * The weight the label states. The standard parcel states its own weight;
 * a parcel sized from SKUs keeps the service-maximum rule (declaredGrams).
 */
export function labelGrams(parcelGrams: number, serviceMaxGrams: number, standard: boolean): number {
  return standard ? parcelGrams : declaredGrams(parcelGrams, serviceMaxGrams);
}
