/**
 * Who carries a parcel, and the carrier's own tracking page for its number,
 * for the customer emails, the order page and the admin. Pure.
 *
 * Royal Mail's link is the one it publishes for other sites to use
 * (royalmail.com, "URL links - Using the tracking reference number"), and
 * only for the number shape it documents there: two letters, nine digits,
 * "GB", never an EA–EE or CP prefix (those are Parcelforce's). A number in
 * any other shape gets no link rather than one that opens on "not found".
 * Amazon's is the public page Amazon Shipping tells sellers to link to.
 * Any other carrier gets no link: the number is still shown.
 */

export type CarrierGroup = "amazon" | "royalmail" | "other";

const groupOf = (name: string): CarrierGroup =>
  /amazon/i.test(name) ? "amazon" : /royal ?mail/i.test(name) ? "royalmail" : "other";

/**
 * Which carrier a label is with, from everything that names it, most
 * trustworthy first: what SmartTrack's tracking calls it, then the service
 * the label was bought on, then the delivery option the customer paid for.
 * The first name that says Amazon or Royal Mail decides.
 */
export function carrierGroup(...names: (string | null | undefined)[]): CarrierGroup {
  for (const name of names) {
    const group = name ? groupOf(name) : "other";
    if (group !== "other") return group;
  }
  return "other";
}

/** What customers are shown, rather than SmartTrack's "NW Amazon" or "Royal Mail Nenix". */
const CARRIER_NAMES: Record<Exclude<CarrierGroup, "other">, string> = { amazon: "Amazon", royalmail: "Royal Mail" };

const ROYAL_MAIL_NUMBER = /^[A-Z]{2}\d{9}GB$/;
const PARCELFORCE_PREFIX = /^(E[A-E]|CP)/;

/** The carrier's tracking page for this number, or null when there is no link to trust. */
export function carrierTrackingUrl(group: CarrierGroup, number: string): string | null {
  const n = number.replace(/\s+/g, "");
  if (!n) return null;
  if (group === "amazon") return `https://track.amazon.co.uk/tracking/${encodeURIComponent(n)}`;
  if (group === "royalmail") {
    const rm = n.toUpperCase();
    if (ROYAL_MAIL_NUMBER.test(rm) && !PARCELFORCE_PREFIX.test(rm)) {
      return `https://www.royalmail.com/portal/rm/track?trackNumber=${rm}`;
    }
  }
  return null;
}

/**
 * The carrier's name as customers should read it, and the link for this
 * number. An unrecognised carrier keeps the first name given for it.
 */
export function trackingLink(
  number: string,
  ...names: (string | null | undefined)[]
): { carrier: string; url: string | null } {
  const group = carrierGroup(...names);
  return {
    carrier: group === "other" ? (names.find((n) => n?.trim())?.trim() ?? "") : CARRIER_NAMES[group],
    url: carrierTrackingUrl(group, number),
  };
}
