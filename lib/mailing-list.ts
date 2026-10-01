import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type Subscriber } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalOrigin } from "@/lib/site-url";
import { SHOP_TIME_ZONE } from "@/lib/saleTime";
import { MAILING_LIST, type BundleId } from "@/config/funnel";

// The mailing list and its welcome gift: one free vial on a subscriber's
// first order.
//
// How the gift reaches the order, in the order it is tried:
//  1. The browser that signed up carries a signed cookie (SUBSCRIBER_COOKIE).
//     Checkout reads it, adds a £0 line to the order and to the Stripe page,
//     so the customer sees the vial before paying.
//  2. Payment lands (lib/payments/fulfillment.ts) and the gift is CLAIMED:
//     Subscriber.welcomeOrderId is set by a conditional update, so two orders
//     racing for one gift cannot both keep it.
//  3. No cookie (signed up on another device): fulfilment matches the paid
//     order's email to a subscriber instead, and adds the line then.
// Either way the line is on the order before stock is allocated, so the pick
// list, the pick label and the packing slip all carry it.
//
// A subscriber who has had the second reminder (lib/welcome-reminders.ts)
// gets extra vials on a big enough first order: the same line, with a larger
// quantity. See welcomeVialCount().

export const SUBSCRIBER_COOKIE = "bl_sub";
export const SUBSCRIBER_COOKIE_MAX_AGE = 365 * 24 * 3600;

/** Every email is stored and compared lower-cased and trimmed. */
export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function key(): string {
  return process.env.JWT_SECRET ?? "";
}

// Domain-separated from the unsubscribe signature, which HMACs a bare email
// with the same key: a value signed for one purpose must never verify for
// the other. The same goes for the two kinds of subscriber token.
type TokenPurpose = "subscriber" | "subscriber-link";
function tokenSig(subscriberId: string, purpose: TokenPurpose = "subscriber"): string {
  return createHmac("sha256", key()).update(`${purpose}:${subscriberId}`).digest("hex");
}

/** The cookie value: the subscriber id and its signature. */
export function signSubscriberToken(subscriberId: string): string {
  return `${subscriberId}.${tokenSig(subscriberId)}`;
}

const LINK_MARK = ".link";

/**
 * The token in an email's link (welcomeLink), which becomes the cookie on
 * whichever device opens it. Marked and signed apart from the signup form's
 * token because it proves less: the form's token was handed to the browser
 * that typed the address, this one to anyone holding the email. See
 * isLinkToken().
 */
export function signSubscriberLinkToken(subscriberId: string): string {
  return `${subscriberId}${LINK_MARK}.${tokenSig(subscriberId, "subscriber-link")}`;
}

function parseToken(token: string | null | undefined): { id: string; link: boolean } | null {
  if (!token || !key()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const head = token.slice(0, dot);
  const link = head.endsWith(LINK_MARK);
  const id = link ? head.slice(0, -LINK_MARK.length) : head;
  if (!id) return null;
  const given = Buffer.from(token.slice(dot + 1), "hex");
  const expected = Buffer.from(tokenSig(id, link ? "subscriber-link" : "subscriber"), "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { id, link };
}

/** The subscriber id from a cookie value of either kind, or null if it was not signed by us. */
export function readSubscriberToken(token: string | null | undefined): string | null {
  return parseToken(token)?.id ?? null;
}

/**
 * Did this cookie come from an email's link rather than the signup form?
 * Checkout does not lock such a browser's Stripe page to the subscriber's
 * email: a link can be forwarded, and whoever opened it must be able to pay
 * under their own address.
 */
export function isLinkToken(token: string | null | undefined): boolean {
  return parseToken(token)?.link === true;
}

/**
 * The button in the welcome email and its reminders. It goes through
 * app/api/subscribe/link/route.ts, which sets the cookie, so the vial shows
 * on the site and on the payment page whichever device opens the email.
 * `pack` lands on that pack's page instead of the home page's buy block.
 */
export function welcomeLink(subscriberId: string, pack?: BundleId): string {
  const query = new URLSearchParams({ t: signSubscriberLinkToken(subscriberId), ...(pack ? { pack } : {}) });
  return `${canonicalOrigin()}/api/subscribe/link?${query}`;
}

/** Pull one cookie out of a raw Cookie header. */
export function cookieFrom(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Enough to spot one machine signing up many addresses; not enough to locate it. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${key()}:${ip}`).digest("hex").slice(0, 32);
}

/** Is the welcome gift switched on at all? */
export function welcomeVialOn(): boolean {
  return MAILING_LIST.enabled && MAILING_LIST.welcomeVial.enabled;
}

// ── The order line ─────────────────────────────────────────────────

/** The fields of an Order.items entry this module reads and writes. */
export interface OrderItemLike {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  lineTotal?: string;
  bundleId?: string;
  welcome?: boolean;
  [extra: string]: unknown;
}

/**
 * The free vial, as an Order.items line. No bundleId, so
 * lib/inventory/demand.ts soldLines() reads it as the single-vial SKU and the
 * warehouse picks it like any other vial. Priced at zero so every total that
 * sums lineTotal still reconciles to what was charged. `qty` is more than
 * one only with the reminder bonus: see welcomeVialCount().
 */
export function welcomeItem(productId: string, slug: string, qty = 1): OrderItemLike {
  return {
    productId,
    slug,
    name: MAILING_LIST.welcomeLineName,
    qty,
    unitPrice: "0.00",
    unitPriceUsd: "0.00",
    lineTotal: "0.00",
    lineTotalUsd: "0.00",
    welcome: true,
  };
}

export function isWelcomeItem(item: object): boolean {
  return (item as { welcome?: unknown }).welcome === true;
}

// ── Eligibility ────────────────────────────────────────────────────

/**
 * The rule, with the database lookups already done. Pure so the test script
 * can cover every branch.
 */
export function welcomeEligible(
  sub: Pick<Subscriber, "status" | "welcomeOrderId"> | null,
  previousOrders: number,
  on: boolean = welcomeVialOn()
): boolean {
  if (!on || !sub) return false;
  if (sub.status !== "subscribed") return false;
  if (sub.welcomeOrderId) return false;
  return previousOrders === 0;
}

// ── The second reminder's bonus ────────────────────────────────────

/**
 * The bonus is honoured this long past Subscriber.welcomeBonusUntil. The
 * email names that moment's date, not its time, so the whole of the named
 * day has to count.
 */
const BONUS_GRACE_MS = 24 * 3600 * 1000;

/** Is the bonus this subscriber was emailed still open at `at`? */
export function bonusActive(sub: Pick<Subscriber, "welcomeBonusUntil">, at: Date = new Date()): boolean {
  return sub.welcomeBonusUntil !== null && at.getTime() <= sub.welcomeBonusUntil.getTime() + BONUS_GRACE_MS;
}

/**
 * How many free vials an eligible subscriber's first order carries: the
 * welcome vial, plus the bonus (MAILING_LIST.reminders.bonus) while it is
 * open and the order pays for enough vials. Pure, like welcomeEligible().
 */
export function welcomeVialCount(
  sub: Pick<Subscriber, "welcomeBonusUntil">,
  paidVials: number,
  at: Date = new Date()
): number {
  const { extraVials, minVials } = MAILING_LIST.reminders.bonus;
  return bonusActive(sub, at) && paidVials >= minVials ? 1 + extraVials : 1;
}

/** "Sunday 11 October": the bonus's last day, as the email and the buy block state it. */
export function bonusDeadlineText(until: Date): string {
  return until.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SHOP_TIME_ZONE,
  });
}

/** The bonus as the buy block shows it (GET /api/subscribe). */
export interface BonusOffer {
  /** Free vials in all on an order that earns it. */
  vials: number;
  minVials: number;
  /**
   * The last day to say, or null in the grace period after it: the vials are
   * still added then, but nobody is told to hurry for a day that has gone.
   */
  by: string | null;
}

export function bonusOffer(sub: Pick<Subscriber, "welcomeBonusUntil">, at: Date = new Date()): BonusOffer | null {
  if (!sub.welcomeBonusUntil || !bonusActive(sub, at)) return null;
  const { extraVials, minVials } = MAILING_LIST.reminders.bonus;
  const stated = bonusDeadlineText(sub.welcomeBonusUntil);
  const dayOver = at > sub.welcomeBonusUntil && bonusDeadlineText(at) !== stated;
  return { vials: 1 + extraVials, minVials, by: dayOver ? null : stated };
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Orders this email has actually placed. Pending checkouts that were never
 * paid do not count, and neither do cancellations. Case-insensitive, because
 * Order.customerEmail is stored however Stripe or the form supplied it.
 */
export async function previousOrderCount(email: string, excludeOrderId = "", db: Db = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM "Order"
    WHERE lower("customerEmail") = ${normEmail(email)}
      AND "status" NOT IN ('pending', 'cancelled')
      AND "id" != ${excludeOrderId}`;
  return Number(rows[0]?.n ?? 0);
}

/** The subscriber a browser's cookie names, or null. */
export async function subscriberFromCookie(cookieHeader: string | null): Promise<Subscriber | null> {
  const id = readSubscriberToken(cookieFrom(cookieHeader, SUBSCRIBER_COOKIE));
  return id ? prisma.subscriber.findUnique({ where: { id } }) : null;
}

/**
 * The subscriber whose gift belongs on a new checkout, or null. The signed-up
 * browser's cookie wins; otherwise the email typed at checkout (crypto only,
 * since card customers give theirs on Stripe's page).
 */
export async function welcomeForCheckout(opts: {
  cookieHeader: string | null;
  email?: string;
}): Promise<Subscriber | null> {
  if (!welcomeVialOn()) return null;
  try {
    const sub =
      (await subscriberFromCookie(opts.cookieHeader)) ??
      (opts.email ? await prisma.subscriber.findUnique({ where: { email: normEmail(opts.email) } }) : null);
    if (!sub) return null;
    return welcomeEligible(sub, await previousOrderCount(sub.email)) ? sub : null;
  } catch (err) {
    // A lookup failure costs the customer a gift, never the sale.
    console.error("[mailing-list] welcome check failed at checkout", err);
    return null;
  }
}

/**
 * Settle the gift on an order whose payment has just been claimed. Runs
 * inside fulfilment's transaction, before stock is taken, and returns the
 * items JSON to fulfil from (unchanged, the gift removed, or the gift added).
 *
 *  - The order carries the line from checkout: claim it. Losing the claim
 *    (the same subscriber paid for another order first) removes the line.
 *  - It does not: if the paid email belongs to an eligible subscriber, add
 *    the line and claim it, with the bonus vials if the order earned them
 *    when checkout began. Legacy stock that cannot cover the bonus gives the
 *    one vial; stock that cannot cover that gives none, so the gift never
 *    oversells.
 */
export async function settleWelcomeVial(
  tx: Prisma.TransactionClient,
  order: { id: string; items: string; customerEmail: string; welcomeSubscriberId: string | null; createdAt: Date },
  opts: { legacyStockCheck: boolean }
): Promise<{ items: string; note: string | null; subscriberId: string | null }> {
  const items = JSON.parse(order.items) as OrderItemLike[];
  const unchanged = { items: order.items, note: null, subscriberId: order.welcomeSubscriberId };
  const now = new Date();

  if (items.some(isWelcomeItem)) {
    const claimed = order.welcomeSubscriberId
      ? (
          await tx.subscriber.updateMany({
            where: { id: order.welcomeSubscriberId, welcomeOrderId: null },
            data: { welcomeOrderId: order.id, welcomeClaimedAt: now },
          })
        ).count === 1
      : false;
    if (claimed) return unchanged;
    return {
      items: JSON.stringify(items.filter((i) => !isWelcomeItem(i))),
      note: "Welcome vial removed: this subscriber's gift was already used on another order.",
      subscriberId: null,
    };
  }

  if (!welcomeVialOn() || !order.customerEmail) return unchanged;
  const sub = await tx.subscriber.findUnique({ where: { email: normEmail(order.customerEmail) } });
  if (!sub || !welcomeEligible(sub, await previousOrderCount(order.customerEmail, order.id, tx))) {
    return unchanged;
  }
  const vial = items[0];
  if (!vial) return unchanged;

  const paidVials = items.reduce((n, i) => n + i.qty, 0);
  let qty = welcomeVialCount(sub, paidVials, order.createdAt);
  if (opts.legacyStockCheck) {
    const product = await tx.product.findUnique({ where: { id: vial.productId } });
    const stock = product?.stock ?? 0;
    if (stock < paidVials + qty) qty = 1;
    if (stock < paidVials + qty) return unchanged;
  }

  const { count } = await tx.subscriber.updateMany({
    where: { id: sub.id, welcomeOrderId: null },
    data: { welcomeOrderId: order.id, welcomeClaimedAt: now },
  });
  if (count !== 1) return unchanged;
  return {
    items: JSON.stringify([...items, welcomeItem(vial.productId, vial.slug, qty)]),
    note: null,
    subscriberId: sub.id,
  };
}

// ── Admin reads ────────────────────────────────────────────────────

export const SUBSCRIBER_FILTERS = ["all", "subscribed", "unsubscribed", "redeemed", "not_ordered"] as const;
export type SubscriberFilter = (typeof SUBSCRIBER_FILTERS)[number];

export interface SubscriberRow extends Subscriber {
  orderCount: number;
  /**
   * The welcome order shipped to an address that an earlier welcome order
   * also went to: one person signing up under several emails. Flagged for a
   * human to look at, never acted on automatically.
   */
  duplicateAddress: boolean;
}

/** Postcode plus first address line, squashed, as the duplicate test's key. */
export function addressKey(shippingAddress: string): string | null {
  try {
    const a = JSON.parse(shippingAddress) as { line1?: string; postalCode?: string };
    const key = `${a.postalCode ?? ""}|${a.line1 ?? ""}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
    return key.length > 3 ? key : null;
  } catch {
    return null;
  }
}

/** The subscribers list for /admin/subscribers and its CSV export. */
export async function subscriberRows(opts: {
  filter: SubscriberFilter;
  q?: string;
  take?: number;
}): Promise<SubscriberRow[]> {
  const where: Prisma.SubscriberWhereInput = {
    ...(opts.q ? { email: { contains: normEmail(opts.q) } } : {}),
    ...(opts.filter === "subscribed" || opts.filter === "not_ordered" ? { status: "subscribed" } : {}),
    ...(opts.filter === "unsubscribed" ? { status: "unsubscribed" } : {}),
    ...(opts.filter === "redeemed" ? { welcomeOrderId: { not: null } } : {}),
  };
  const subs = await prisma.subscriber.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(opts.take ? { take: opts.take } : {}),
  });

  // Orders per address, case-insensitively, for just these subscribers.
  const counts = new Map<string, number>();
  if (subs.length > 0) {
    const emails = subs.map((s) => s.email);
    const rows = await prisma.$queryRaw<{ email: string; n: bigint | number }[]>`
      SELECT lower("customerEmail") AS email, COUNT(*) AS n FROM "Order"
      WHERE "status" NOT IN ('pending', 'cancelled')
        AND lower("customerEmail") IN (${Prisma.join(emails)})
      GROUP BY lower("customerEmail")`;
    for (const r of rows) counts.set(r.email, Number(r.n));
  }

  // Every welcome order, oldest first: an address seen before is a repeat.
  const welcomeOrders = await prisma.order.findMany({
    where: { welcomeSubscriberId: { not: null }, status: { notIn: ["pending", "cancelled"] } },
    select: { id: true, shippingAddress: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const repeats = new Set<string>();
  for (const o of welcomeOrders) {
    const k = addressKey(o.shippingAddress);
    if (!k) continue;
    if (seen.has(k)) repeats.add(o.id);
    seen.add(k);
  }

  return subs
    .map((s) => ({
      ...s,
      orderCount: counts.get(s.email) ?? 0,
      duplicateAddress: s.welcomeOrderId ? repeats.has(s.welcomeOrderId) : false,
    }))
    .filter((s) => opts.filter !== "not_ordered" || s.orderCount === 0);
}

export async function subscriberStats(): Promise<{ subscribed: number; lastWeek: number; redeemed: number }> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [subscribed, lastWeek, redeemed] = await Promise.all([
    prisma.subscriber.count({ where: { status: "subscribed" } }),
    prisma.subscriber.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.subscriber.count({ where: { welcomeOrderId: { not: null } } }),
  ]);
  return { subscribed, lastWeek, redeemed };
}
