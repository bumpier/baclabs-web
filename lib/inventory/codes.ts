/**
 * SKU and location codes.
 *
 * A code is what a person reads off a shelf label and a scanner reads off a
 * barcode, so it is held to the rules that keep both of those reliable:
 * upper case (scanners and people disagree about case, so it is removed as a
 * variable), no spaces (a space ends a scan in some keyboard-wedge setups),
 * and only characters every 1D symbology can carry. Letters, digits or a
 * mixture are all fine — "SKU" does not mean "number".
 *
 * 40 characters is SmartTrack's limit for item_sku and is already far longer
 * than a code anyone should have to key in.
 */
export const SKU_CODE_MAX = 40;
const SKU_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9._-]*[A-Z0-9])?$/;

export const LOCATION_CODE_MAX = 30;
const LOCATION_CODE_PATTERN = SKU_CODE_PATTERN;

export const WAREHOUSE_CODE_MAX = 12;
const WAREHOUSE_CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/;

/** Trim and upper-case. Every write and every lookup goes through this. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function check(code: string, pattern: RegExp, max: number, what: string): string | null {
  if (code.length === 0) return `Enter a ${what}`;
  if (code.length > max) return `A ${what} can be at most ${max} characters`;
  if (!pattern.test(code)) {
    return `A ${what} can only use letters, numbers, dots, dashes and underscores, and must start and end with a letter or number`;
  }
  return null;
}

/**
 * What a scanned barcode starts with says what it is: a pick label, a shelf,
 * or — anything else — a product. See lib/inventory/scan.ts. A SKU code may
 * not start with either, or its barcode would be read as the wrong thing.
 */
export const ORDER_SCAN_PREFIX = "ORD-";
export const LOCATION_SCAN_PREFIX = "LOC-";

/** Null when valid, otherwise the message to show. Pass a normalised code. */
export function skuCodeError(code: string): string | null {
  if (code.startsWith(ORDER_SCAN_PREFIX) || code.startsWith(LOCATION_SCAN_PREFIX)) {
    return `A SKU code cannot start with ${ORDER_SCAN_PREFIX} or ${LOCATION_SCAN_PREFIX} — those mark pick-label and shelf barcodes`;
  }
  return check(code, SKU_CODE_PATTERN, SKU_CODE_MAX, "SKU code");
}

export function locationCodeError(code: string): string | null {
  return check(code, LOCATION_CODE_PATTERN, LOCATION_CODE_MAX, "location code");
}

export function warehouseCodeError(code: string): string | null {
  return check(code, WAREHOUSE_CODE_PATTERN, WAREHOUSE_CODE_MAX, "warehouse code");
}

/**
 * Why stock was adjusted by hand. A fixed list, so the ledger can be read
 * back by reason; "Other" requires a note. Splitting a pack is two
 * adjustments — the pack out, the singles in — both under the same reason.
 */
export const ADJUST_REASONS = [
  "Stock count correction",
  "Split pack into singles",
  "Made up a pack",
  "Damaged",
  "Expired",
  "Found",
  "Lost",
  "Sample",
  "Other",
] as const;
