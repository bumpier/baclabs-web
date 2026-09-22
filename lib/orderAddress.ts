import type { Order } from "@prisma/client";

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  country: string;
  postalCode: string | null;
}

/**
 * Card orders carry no address until the Stripe webhook backfills it, so a
 * pending card order legitimately comes back null here.
 */
export function parseAddress(order: Pick<Order, "shippingAddress">): Address | null {
  return order.shippingAddress ? (JSON.parse(order.shippingAddress) as Address) : null;
}

/** Same shape the packing slip uses: street, then town with postcode, then country. */
export function addressLines(address: Address): string[] {
  return [
    address.line1,
    address.line2 ?? "",
    address.postalCode ? `${address.city}, ${address.postalCode}` : address.city,
    address.country,
  ].filter((line) => line.trim().length > 0);
}
