import { brand } from "@/config/brand";

/**
 * Shared facts for the legal pages, so /terms, /privacy, /returns and
 * /disclaimer cannot drift apart on who "we" are or when the wording last
 * changed. Nothing here is presentation — see components/LegalPage.tsx.
 */

/**
 * Bump this whenever the wording of ANY legal page changes. It is rendered on
 * every one of them, and a policy with a stale "last updated" date is worse
 * than one with none: it asserts a review that did not happen.
 */
export const LEGAL_LAST_UPDATED = "4 September 2026";

/**
 * Still outstanding before these pages are launch-ready. NOTHING below is
 * flagged on the page any more — an unsupplied fact is omitted from the
 * wording rather than marked up, so this list is the ONLY record of it and
 * the pages will not tell you what is missing:
 *   1. `brand.company` and `brand.contact` filled in (config/brand.ts),
 *   2. `RETURNS_ADDRESS` below set,
 *   3. `VAT.statement` set (config/funnel.ts), and
 *   4. a solicitor having read the wording — in particular the sealed-goods
 *      exemption relied on in /returns and the product framing in /disclaimer.
 *
 * Work through 1 to 3 here and in config/ before taking a real order.
 */

/**
 * Postal address a customer sends a return to. Empty is handled in prose on
 * /returns: the page undertakes to supply the address on cancellation instead
 * of printing a stand-in where an address belongs.
 */
export const RETURNS_ADDRESS = ""; // full returns address, one line per part

/** Days from delivery within which a customer must report damage in transit. */
export const DAMAGE_REPORT_DAYS = 14;

/** Working days we aim to acknowledge a complaint within. */
export const COMPLAINT_ACK_DAYS = 2;

/** Years order and payment records are kept, driven by HMRC requirements. */
export const RECORD_RETENTION_YEARS = 6;

/**
 * The name the contract is made with. With no registered name configured this
 * is the brand name — a real party to name, not a placeholder for one.
 */
export function legalName(): string {
  return brand.company.legalName || brand.name;
}

/** Support address, or null when config/brand.ts has none set. */
export function supportEmail(): string | null {
  return brand.contact.email || null;
}

/**
 * True when a value is a real, operator-supplied fact rather than empty. Gates
 * whether a clause or table row renders at all; there is no placeholder branch.
 */
export function isSet(value: string): boolean {
  return Boolean(value);
}
