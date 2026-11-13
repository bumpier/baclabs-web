/**
 * BulkBac's mailbox, hello@bulkbac.co.uk (Hostinger), and the quote emails
 * that go to it. Quotes are done by email (the owner, 13 Nov 2026): every
 * "Get a quote" on the site opens the buyer's mail app with a request
 * addressed here, its subject and the facts to fill in already written.
 * The profile uses the same address for replies, contact and the inbox.
 */
export const MAILBOX = "hello@bulkbac.co.uk";

/** A mailto: link for a quote, on one pack size or (no size) a large or standing order. */
export function quoteMailto(vials?: number): string {
  const size = vials ? `${vials.toLocaleString("en-GB")} vials` : "";
  const subject = size ? `Quote: packs of ${size}` : "Quote request";
  const body = [
    `Pack size: ${size}`,
    "How many packs: ",
    "Delivery postcode: ",
    "One-off or recurring: ",
    "Company (optional): ",
    "",
  ].join("\n");
  return `mailto:${MAILBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
