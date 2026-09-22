import { LOCATION_SCAN_PREFIX, normaliseCode, ORDER_SCAN_PREFIX } from "@/lib/inventory/codes";

/**
 * What the barcodes say, and what a scan at the packing station means.
 * Pure — lib/inventory/picking.ts applies the decisions to the database.
 *
 * THE BARCODE CONTENTS ARE A DRAFT, pending the conversation with the
 * fulfilment team about what they should hold. Everything that decides them
 * is in the first three functions below, so settling it is a change here and
 * nowhere else:
 *
 *   pick label   2D code — see pickLabelPayload() below
 *   shelf        LOC-A-01-02     the location code
 *   product      the maker's barcode (EAN) if the SKU has one, else its code
 *
 * orderScanCode ("ORD-3F9A1C2D") is the pick label's human-readable
 * reference, and is still accepted if typed at the scan station.
 */

export function orderScanCode(orderId: string): string {
  return `${ORDER_SCAN_PREFIX}${orderId.slice(0, 8).toUpperCase()}`;
}

export function locationScanCode(locationCode: string): string {
  return `${LOCATION_SCAN_PREFIX}${locationCode}`;
}

export function productScanCode(sku: { code: string; barcode: string | null }): string {
  return sku.barcode || sku.code;
}

/** Starts the pick label's 2D code. Distinct from ORDER_SCAN_PREFIX ("ORD-"). */
const PICK_PAYLOAD_PREFIX = "ORD:";

/**
 * What the pick label's 2D (QR) code holds: the order and, for every line,
 * the shelf, the item and how many. Each shelf and item value is exactly what
 * that shelf's and product's own barcode says, so the fulfilment system can
 * check a scan against the pick label with no lookup:
 *
 *   ORD:3F9A1C2D;SHELF:LOC-A-01,ITEM:BACLAB-10ML,QTY:3;SHELF:LOC-Z-99,ITEM:BACLAB-10ML,QTY:2
 *
 * One line, and only characters every keyboard layout agrees on (letters,
 * digits, - . _ : ; ,). A scanner acting as a keyboard types the code into
 * whatever reads it, and a US-layout scanner on a UK computer turns " @ # |
 * into other characters; a line break would be typed as Enter.
 *
 * Draft format until the fulfilment team confirms theirs.
 */
export function pickLabelPayload(
  orderId: string,
  lines: readonly { locationCode: string; sku: { code: string; barcode: string | null }; quantity: number }[]
): string {
  const order = `${PICK_PAYLOAD_PREFIX}${orderId.slice(0, 8).toUpperCase()}`;
  const items = lines.map(
    (l) => `SHELF:${locationScanCode(l.locationCode)},ITEM:${productScanCode(l.sku)},QTY:${l.quantity}`
  );
  return [order, ...items].join(";");
}

export type ParsedScan =
  | { kind: "order"; ref: string }
  | { kind: "location"; code: string }
  | { kind: "product"; value: string };

/**
 * Read what a scanner typed. Keyboard-wedge scanners can add stray control
 * characters or spaces; those are dropped. Case is ignored for our own
 * prefixes and codes, but a maker's barcode is matched as scanned.
 */
export function parseScan(raw: string): ParsedScan | null {
  const value = raw.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  // The pick label's 2D code: the order reference is its first field.
  if (upper.startsWith(PICK_PAYLOAD_PREFIX)) {
    const ref = upper.slice(PICK_PAYLOAD_PREFIX.length).split(";")[0] ?? "";
    return /^[0-9A-F]{8}$/.test(ref) ? { kind: "order", ref } : null;
  }
  if (upper.startsWith(ORDER_SCAN_PREFIX)) {
    const ref = upper.slice(ORDER_SCAN_PREFIX.length);
    return /^[0-9A-F]{8}$/.test(ref) ? { kind: "order", ref } : null;
  }
  if (upper.startsWith(LOCATION_SCAN_PREFIX)) {
    const code = upper.slice(LOCATION_SCAN_PREFIX.length);
    return code ? { kind: "location", code } : null;
  }
  return { kind: "product", value };
}

// ── Tallying a pick ──────────────────────────────────────────────

/** One pick-list line as the scan station sees it. */
export interface PickLineState {
  id: string;
  /** Null for a shortfall line — nothing on the shelf to scan. */
  locationCode: string | null;
  skuCode: string;
  skuBarcode: string | null;
  quantity: number;
  picked: number;
}

export type ScanDecision =
  | { ok: true; updates: { lineId: string; picked: number }[]; message: string }
  | { ok: false; message: string };

const outstanding = (l: PickLineState) => l.locationCode !== null && l.picked < l.quantity;

/**
 * Is this scan right for this order, and what does it tick off?
 *
 *  - A SHELF scan confirms the picker is at a location this order takes from,
 *    and ticks off everything taken from it: the pick label already says how
 *    many to take there.
 *  - A PRODUCT scan counts one unit of that SKU against the first line still
 *    wanting it, in walking order.
 *
 * Anything else — a shelf or product this order does not use, or one already
 * fully picked — is a wrong scan, and changes nothing.
 *
 * `lines` must be in walking order (pick sequence, then location code).
 */
export function decideScan(lines: readonly PickLineState[], scan: ParsedScan): ScanDecision {
  if (scan.kind === "order") {
    return { ok: false, message: "That is a pick label — finish this order or start again first" };
  }

  if (scan.kind === "location") {
    const here = lines.filter((l) => l.locationCode === scan.code);
    if (here.length === 0) {
      const shelves = [...new Set(lines.map((l) => l.locationCode).filter(Boolean))].join(", ");
      return { ok: false, message: `Wrong shelf: ${scan.code}. This order picks from ${shelves || "nowhere"}.` };
    }
    const todo = here.filter(outstanding);
    if (todo.length === 0) return { ok: false, message: `${scan.code} is already picked` };
    return {
      ok: true,
      updates: todo.map((l) => ({ lineId: l.id, picked: l.quantity })),
      message: `${scan.code}: take ${todo.map((l) => `${l.quantity - l.picked} × ${l.skuCode}`).join(", ")}`,
    };
  }

  const code = normaliseCode(scan.value);
  const matches = lines.filter((l) => l.skuCode === code || (l.skuBarcode !== null && l.skuBarcode === scan.value));
  if (matches.length === 0) return { ok: false, message: `Wrong item: ${scan.value} is not on this order` };
  const line = matches.find(outstanding);
  if (!line) {
    const total = matches.reduce((n, l) => n + l.quantity, 0);
    return { ok: false, message: `Already have all ${total} × ${matches[0]!.skuCode}` };
  }
  const done = matches.reduce((n, l) => n + l.picked, 0) + 1;
  const total = matches.reduce((n, l) => n + l.quantity, 0);
  return {
    ok: true,
    updates: [{ lineId: line.id, picked: line.picked + 1 }],
    message: `${line.skuCode}: ${done} of ${total}`,
  };
}

/** Every unit on the shelf lines picked, and nothing short. */
export function isPickComplete(lines: readonly PickLineState[]): boolean {
  return (
    lines.length > 0 &&
    lines.every((l) => l.locationCode !== null) &&
    lines.every((l) => l.picked >= l.quantity)
  );
}
