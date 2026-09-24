import type { Address } from "@/lib/orderAddress";
import type { Parcel } from "@/lib/shipping/parcel";
import type { ParcelItemRequest, ShipmentRequest } from "@/lib/smarttrack/client";

/**
 * Turn an order into SmartTrack's generate-label body. Pure, so every rule
 * below is covered by scripts/test-shipping.ts rather than discovered on a
 * label that has already been paid for.
 *
 * Two things matter more than anything else here:
 *
 *  1. UNITS. This codebase holds grams and millimetres; SmartTrack wants kg
 *     and cm. This is the only place that converts.
 *  2. FIELD LENGTHS. SmartTrack caps every field (30 characters for a sender
 *     address line, 40 for a receiver's). An address is never truncated —
 *     a cut-off street is a parcel that goes to the wrong door — it is
 *     re-flowed across the three lines SmartTrack allows, at word breaks.
 *     Anything that still does not fit is reported as a problem and no
 *     label is bought.
 */

export const LIMITS = {
  reference: 40,
  description: 30,
  senderContact: 40,
  senderCompany: 25,
  senderEmail: 45,
  senderLine: 30,
  senderCity: 25,
  receiverContact: 50,
  receiverEmail: 45,
  receiverLine: 40,
  receiverCity: 25,
  postcode: 10,
  telephone: 17,
  itemDescription: 60,
} as const;

/**
 * Re-flow address lines to fit `max` characters, keeping the customer's own
 * line breaks and only breaking long lines between words. Null when the
 * result needs more than `maxLines`, or a single word is longer than a line.
 */
export function wrapLines(lines: readonly string[], max: number, maxLines = 3): string[] | null {
  const out: string[] = [];
  for (const raw of lines) {
    let rest = raw.replace(/\s+/g, " ").trim();
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      if (cut <= 0) return null;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.length > 0 && out.length <= maxLines ? out : null;
}

/** Shorten at a word break. For descriptions only — never for an address. */
export function truncateWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max);
  return (cut > 0 ? clean.slice(0, cut) : clean.slice(0, max)).trim();
}

/**
 * Tidy delivery instructions typed by a customer or staff: one line, single
 * spaces, and never longer than SmartTrack's description field, since a
 * refused label is worse than a shortened note. Null when blank.
 */
export function cleanDeliveryInstructions(text: unknown): string | null {
  const clean = truncateWords(String(text ?? "").replace(/\s+/g, " "), LIMITS.description);
  return clean || null;
}

const kg = (grams: number) => Math.round(grams) / 1000;
const cm = (mm: number) => Math.round(mm) / 10;
const pounds = (minor: number) => Math.round(minor) / 100;

export interface Sender {
  contactName: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  countryIso: string;
  phone: string;
  email: string;
}

export interface LabelItem {
  skuCode: string;
  description: string;
  quantity: number;
  unitWeightGrams: number;
  lineTotalMinor: number;
  hsCode?: string | null;
  originCountryIso?: string | null;
}

export interface LabelInput {
  /** SmartTrack order_reference — unique per label attempt. */
  reference: string;
  /** What staff call the order, e.g. the first 8 of its id. */
  orderRef: string;
  serviceCode: string;
  labelSize: string;
  sender: Sender;
  receiver: { name: string; email: string; phone: string; address: Address };
  parcel: Parcel;
  items: LabelItem[];
  goodsTotalMinor: number;
  currency: string;
  /**
   * SmartTrack's required consignment `description`, used for the
   * operator's delivery instructions ("Leave at doorstep") — SmartTrack's own
   * example uses it that way. What is in the box travels in each item's
   * item_description instead.
   */
  deliveryInstructions: string;
}

export interface BuiltRequest {
  request: ShipmentRequest | null;
  /** Anything here means no label: fix the data first. */
  problems: string[];
  /** Sent anyway, but worth knowing (an optional field left out). */
  warnings: string[];
}

export function buildShipmentRequest(input: LabelInput): BuiltRequest {
  const problems: string[] = [];
  const warnings: string[] = [];
  const s = input.sender;
  const r = input.receiver;

  const required = (value: string, what: string) => {
    if (!value.trim()) problems.push(`${what} is missing`);
    return value.trim();
  };
  const bounded = (value: string, max: number, what: string) => {
    const v = required(value, what);
    if (v.length > max) problems.push(`${what} is ${v.length} characters; SmartTrack allows ${max}`);
    return v;
  };
  const optional = (value: string, max: number, what: string) => {
    const v = value.trim();
    if (!v) return undefined;
    if (v.length > max) {
      warnings.push(`${what} left off: ${v.length} characters, SmartTrack allows ${max}`);
      return undefined;
    }
    return v;
  };
  const iso = (value: string, what: string) => {
    const v = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(v)) problems.push(`${what} must be a two-letter country code, not "${value}"`);
    return v;
  };

  if (input.reference.length > LIMITS.reference) {
    problems.push(`Reference ${input.reference} is longer than ${LIMITS.reference} characters`);
  }

  // Sender — the warehouse.
  const senderLines = wrapLines([s.addressLine1, s.addressLine2], LIMITS.senderLine);
  if (!s.addressLine1.trim()) problems.push("Warehouse address line 1 is missing");
  else if (!senderLines) problems.push(`Warehouse address does not fit SmartTrack's three ${LIMITS.senderLine}-character lines`);
  const senderContact = bounded(s.contactName, LIMITS.senderContact, "Warehouse contact name");
  const senderCity = bounded(s.city, LIMITS.senderCity, "Warehouse town or city");
  const senderPostcode = bounded(s.postcode, LIMITS.postcode, "Warehouse postcode");
  const senderCountry = iso(s.countryIso, "Warehouse country");

  // Receiver — the customer.
  const a = r.address;
  const receiverLines = wrapLines([a.line1, a.line2 ?? ""], LIMITS.receiverLine);
  if (!a.line1.trim()) problems.push("Delivery address line 1 is missing");
  else if (!receiverLines) problems.push(`Delivery address does not fit SmartTrack's three ${LIMITS.receiverLine}-character lines`);
  const receiverContact = bounded(r.name, LIMITS.receiverContact, "Customer name");
  const receiverCity = bounded(a.city, LIMITS.receiverCity, "Delivery town or city");
  const receiverPostcode = bounded(a.postalCode ?? "", LIMITS.postcode, "Delivery postcode");
  const receiverCountry = iso(a.country, "Delivery country");

  // Parcel.
  const p = input.parcel;
  if (p.weightGrams <= 0) problems.push("Parcel weight is not set — add it to the SKU");
  if (!(p.lengthMm > 0 && p.widthMm > 0 && p.heightMm > 0)) {
    problems.push("Parcel size is not set — add length, width and height to the SKU");
  }
  if (input.items.length === 0) problems.push("The order has no items");

  const items: ParcelItemRequest[] = input.items.map((item) => {
    const unitValueMinor = item.quantity > 0 ? item.lineTotalMinor / item.quantity : 0;
    const line: ParcelItemRequest = {
      item_description: truncateWords(item.description || item.skuCode, LIMITS.itemDescription),
      item_sku: item.skuCode,
      no_of_items: item.quantity,
      item_value: pounds(unitValueMinor),
      weight: kg(item.unitWeightGrams),
    };
    if (item.hsCode) line.hscode = item.hsCode;
    if (item.originCountryIso) line.manufacture_country_iso = item.originCountryIso;
    return line;
  });

  // Required by SmartTrack, 30 characters. Never truncated: a cut-off
  // instruction could read as a different one.
  const description = bounded(input.deliveryInstructions, LIMITS.description, "Delivery instructions");

  if (problems.length > 0) return { request: null, problems, warnings };

  const request: ShipmentRequest = {
    service_code: input.serviceCode,
    order_reference: input.reference,
    reference: input.orderRef,
    shipment_type: "D",
    sender_country_iso: senderCountry,
    sender_contact: senderContact,
    sender_company: optional(s.company, LIMITS.senderCompany, "Warehouse company"),
    sender_email: optional(s.email, LIMITS.senderEmail, "Warehouse email"),
    sender_telephone: optional(s.phone, LIMITS.telephone, "Warehouse phone"),
    sender_address_line_1: senderLines![0]!,
    sender_address_line_2: senderLines![1],
    sender_address_line_3: senderLines![2],
    sender_city: senderCity,
    sender_postcode: senderPostcode,
    receiver_country_iso: receiverCountry,
    receiver_contact: receiverContact,
    receiver_email: optional(r.email, LIMITS.receiverEmail, "Customer email"),
    receiver_telephone: optional(r.phone, LIMITS.telephone, "Customer phone"),
    receiver_address_line_1: receiverLines![0]!,
    receiver_address_line_2: receiverLines![1],
    receiver_address_line_3: receiverLines![2],
    receiver_city: receiverCity,
    receiver_postcode: receiverPostcode,
    // Documented as an integer, so whole pounds.
    value: Math.round(input.goodsTotalMinor / 100),
    currency: input.currency,
    description,
    label_type: "pdf",
    label_size: input.labelSize,
    parcel: [
      {
        weight: kg(p.weightGrams),
        length: cm(p.lengthMm),
        width: cm(p.widthMm),
        height: cm(p.heightMm),
        itemvalue: pounds(input.goodsTotalMinor),
        items,
      },
    ],
  };

  // Optional fields left undefined are dropped by JSON.stringify, so the
  // body carries only what has a value.
  return { request, problems, warnings };
}
