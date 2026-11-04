/**
 * A buyer's gift note: a few words for whoever opens the box, taken by a
 * brand whose catalogue asks for one (BrandCatalogue.collectGiftNote). The
 * checkout (lib/commerce/checkout.ts) keeps it as one line of the order's
 * notes, "Gift note: …", as it keeps a trade buyer's company and VAT
 * number. The packing slip prints it, for the packer to put in the box
 * (components/admin/PackingSlip.tsx), and the admin's order page shows it.
 *
 * It never goes to a payment provider: the order a provider is asked to
 * take payment for (lib/commerce/payments/types.ts PaymentOrder) carries
 * lines, goods and delivery, and no notes.
 *
 * Pure and importing nothing, so the checkout and the admin share the
 * line's form, and npm run test:brand-checkout can read every rule.
 */

/** Most characters a note may hold: a gift card's worth, about fifty words. */
export const GIFT_NOTE_MAX = 300;

const PREFIX = "Gift note: ";

/**
 * Characters a note never keeps: control characters (line breaks among
 * them, because the note is one line of the order's notes), and the
 * zero-width and direction marks that could make what prints differ from
 * what was typed.
 */
const UNWANTED = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/**
 * The note as plain text on one line: those characters gone, runs of space
 * collapsed, trimmed, and cut to GIFT_NOTE_MAX. "" when nothing is left.
 */
export function cleanGiftNote(raw: string | null | undefined): string {
  return (raw ?? "").replace(UNWANTED, " ").replace(/\s+/g, " ").trim().slice(0, GIFT_NOTE_MAX).trim();
}

/** The note as its line in the order's notes, or "" when there is none. */
export function giftNoteLine(raw: string | null | undefined): string {
  const note = cleanGiftNote(raw);
  return note ? `${PREFIX}${note}` : "";
}

/** The note an order's notes hold (giftNoteLine's), or null when they hold none. */
export function giftNoteFrom(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith(PREFIX));
  return line ? line.slice(PREFIX.length).trim() || null : null;
}
