// Free vials promised to a customer by email address, usually to say sorry
// for a bad experience. Staff add them on /admin/free-vials, which emails
// the customer straight away. The next parcel order paid with that email
// gets them as one £0 line, added inside fulfilment's transaction
// (lib/payments/fulfillment.ts), so they are taken from stock, picked,
// labelled and shown on the receipt like any vial.
//
// They are added after payment rather than at checkout because a card
// customer types their email on Stripe's page: fulfilment is the first
// point where every order's email is known. The same pattern as the
// mailing-list welcome vial's email match (lib/mailing-list.ts
// settleWelcomeVial), with its own flag so neither is mistaken for the other.
//
// Unused gifts expire GIFT_EXPIRY_DAYS after they were added, at the end of
// the UK day the email names.
import type { Prisma, VialGift } from "@prisma/client";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { ctaButton, escapeHtml, layout, send } from "@/lib/email";
import { normEmail, type OrderItemLike } from "@/lib/mailing-list";
import { canonicalOrigin } from "@/lib/site-url";
import { formatShopDay, shiftDayKey, shopDayBounds, shopDayKey } from "@/lib/saleTime";
import { LITERAL } from "@/lib/theme";

export const GIFT_EXPIRY_DAYS = 90;
export const MAX_GIFT_VIALS = 20;

// ── The order line ─────────────────────────────────────────────────

export function giftLineName(qty: number): string {
  return qty === 1 ? "Free vial, with our apologies" : "Free vials, with our apologies";
}

/**
 * The free vials, as an Order.items line. Like the welcome vial: no
 * bundleId, so lib/inventory/demand.ts soldLines() reads it as the
 * single-vial SKU, and priced at zero so every total that sums lineTotal
 * still reconciles to what was charged.
 */
export function giftItem(productId: string, slug: string, qty: number): OrderItemLike {
  return {
    productId,
    slug,
    name: giftLineName(qty),
    qty,
    unitPrice: "0.00",
    unitPriceUsd: "0.00",
    lineTotal: "0.00",
    lineTotalUsd: "0.00",
    gift: true,
  };
}

export function isGiftItem(item: object): boolean {
  return (item as { gift?: unknown }).gift === true;
}

// ── Expiry and status ──────────────────────────────────────────────

/** The end of the UK day GIFT_EXPIRY_DAYS after `from`: the gift counts on orders begun before it. */
export function giftExpiresAt(from: Date): Date {
  return shopDayBounds(shiftDayKey(shopDayKey(from), GIFT_EXPIRY_DAYS)).end;
}

/** The last UK day a gift can be used, as the email and the admin list name it. */
export function lastGiftDay(expiresAt: Date): string {
  return shopDayKey(new Date(expiresAt.getTime() - 1));
}

export type GiftStatus = "waiting" | "used" | "cancelled" | "expired";

export function giftStatus(gift: Pick<VialGift, "orderId" | "cancelledAt" | "expiresAt">, now: Date): GiftStatus {
  if (gift.orderId) return "used";
  if (gift.cancelledAt) return "cancelled";
  if (now.getTime() >= gift.expiresAt.getTime()) return "expired";
  return "waiting";
}

// ── Fulfilment ─────────────────────────────────────────────────────

/**
 * Add this email's waiting gifts to an order whose payment has just been
 * claimed. Runs inside fulfilment's transaction, after the welcome vial and
 * before stock is taken, and returns the items JSON to fulfil from.
 *
 * Every waiting gift is claimed with a conditional write, so a gift lands on
 * one order only; several gifts become one line. Expiry is judged when the
 * order was created, so a checkout begun on the last day still counts. In
 * legacy stock mode a shortfall leaves the gifts waiting for the next order
 * rather than overselling; warehouse mode records a shortfall at allocation,
 * as it does for the welcome vial.
 */
export async function settleVialGifts(
  tx: Prisma.TransactionClient,
  order: { id: string; items: string; customerEmail: string; createdAt: Date },
  opts: { legacyStockCheck: boolean }
): Promise<{ items: string; note: string | null }> {
  const unchanged = { items: order.items, note: null };
  if (!order.customerEmail.trim()) return unchanged;

  const gifts = await tx.vialGift.findMany({
    where: {
      email: normEmail(order.customerEmail),
      orderId: null,
      cancelledAt: null,
      expiresAt: { gt: order.createdAt },
    },
    orderBy: { createdAt: "asc" },
  });
  if (gifts.length === 0) return unchanged;

  const items = JSON.parse(order.items) as OrderItemLike[];
  const vial = items[0];
  if (!vial) return unchanged;

  if (opts.legacyStockCheck) {
    const promised = gifts.reduce((n, g) => n + g.vials, 0);
    const onOrder = items.reduce((n, i) => n + i.qty, 0);
    const product = await tx.product.findUnique({ where: { id: vial.productId } });
    if ((product?.stock ?? 0) < onOrder + promised) {
      return {
        items: order.items,
        note: `Free vials not added: not enough stock for the ${promised} promised to this email. They are still waiting for the next order.`,
      };
    }
  }

  const now = new Date();
  let qty = 0;
  for (const g of gifts) {
    const { count } = await tx.vialGift.updateMany({
      where: { id: g.id, orderId: null, cancelledAt: null },
      data: { orderId: order.id, claimedAt: now },
    });
    if (count === 1) qty += g.vials;
  }
  if (qty === 0) return unchanged;
  return { items: JSON.stringify([...items, giftItem(vial.productId, vial.slug, qty)]), note: null };
}

// ── Admin reads ────────────────────────────────────────────────────

/** Vials still waiting for this email's next order. */
export async function waitingVials(email: string, now: Date = new Date()): Promise<number> {
  const rows = await prisma.vialGift.findMany({
    where: { email: normEmail(email), orderId: null, cancelledAt: null, expiresAt: { gt: now } },
    select: { vials: true },
  });
  return rows.reduce((n, r) => n + r.vials, 0);
}

// ── The email ──────────────────────────────────────────────────────

/** The first name on this email's latest order, for the greeting. */
async function firstNameFor(email: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ customerName: string }[]>`
    SELECT "customerName" FROM "Order"
    WHERE lower("customerEmail") = ${normEmail(email)} AND "customerName" != ''
    ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0]?.customerName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Pure, so scripts/test-vial-gifts.ts can read it. A note to one customer
 * about their own complaint, sent by hand: a service message, so it carries
 * no unsubscribe footer. The admin form warns before sending to an address
 * that has left the mailing list.
 */
export function giftEmail(
  gift: Pick<VialGift, "vials" | "expiresAt">,
  firstName = ""
): { subject: string; html: string } {
  const what = gift.vials === 1 ? "a free vial" : `${gift.vials} free vials`;
  const What = `${what[0]!.toUpperCase()}${what.slice(1)}`;
  const contact = brand.contact.email;
  const contactLine = contact
    ? `<p>If you have any questions, email us at <a href="mailto:${escapeHtml(contact)}" style="color:${LITERAL.brand}">${escapeHtml(contact)}</a>.</p>`
    : "";
  return {
    subject: `${What} on your next ${brand.name} order, with our apologies`,
    html: layout(
      `<p>Hi ${escapeHtml(firstName || "there")},</p>
      <p>We're sorry your recent experience with us wasn't what it should have been.</p>
      <p>To make up for it, we've added <strong>${gift.vials === 1 ? "a free 10ml vial" : `${gift.vials} free 10ml vials`}</strong> to your next order. There's nothing you need to do: order as usual with this email address and ${gift.vials === 1 ? "it will" : "they'll"} be packed with it.</p>
      <p>We'll hold ${gift.vials === 1 ? "it" : "them"} for you until ${formatShopDay(lastGiftDay(gift.expiresAt))}.</p>
      <p style="margin:24px 0">${ctaButton(`${canonicalOrigin()}/#buy`, "Order now")}</p>
      ${contactLine}
      <p style="margin:0">Thank you for bearing with us,<br />The ${escapeHtml(brand.name)} team</p>`,
      { preheader: `${What}, added to your next order automatically.` }
    ),
  };
}

/** True when Resend took the email; emailedAt is set only then. send() never throws. */
export async function sendGiftEmail(gift: VialGift): Promise<boolean> {
  const { subject, html } = giftEmail(gift, await firstNameFor(gift.email));
  const sent = await send(gift.email, subject, html);
  if (!sent?.id) return false;
  await prisma.vialGift.update({ where: { id: gift.id }, data: { emailedAt: new Date() } });
  return true;
}
