/**
 * The box every brand's packs ship in: one plain, unprinted white box with
 * nothing on it, the same for every brand. The owner, 6 Nov 2026: "our
 * packaging is just a box really, nothing like a purse or a branded box just
 * a plain box", and then that the brands' boxes become one box with one stock
 * count.
 *
 * So every catalogue's boxSku is this code: one warehouse SKU, one shelf of
 * boxes, one stock count, whichever brand sells the pack. A brand that one
 * day ships in a box of its own sets its catalogue's boxSku to that box's
 * code instead (and a profile's shipping.packingNote tells the packer).
 *
 * Nothing about the box is ever claimed on a brand's site beyond what it is:
 * plain, with no branding.
 */
export const PLAIN_BOX_SKU = "PLAIN-BOX";
