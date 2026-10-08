import { BUNDLES } from "@/config/funnel";
import { goodsMinor, optionRank, type TakingsOrder } from "@/lib/dailyTakings";
import { paidMinor } from "@/lib/meta-capi-event";
import { orderKind, type OrderKind } from "@/lib/plans/kinds";
import {
  dayKeysBetween,
  formatMonth,
  formatShopDayShort,
  monthKey,
  saleTime,
  shopDayKey,
  weekKey,
} from "@/lib/saleTime";
import { fulfilmentRateOn, rateOn, vatApplies, vatInside, type Rate } from "@/lib/finance/rates";

/**
 * One order's money, in and out, for /admin/finance and /admin/takings.
 *
 * In: what the customer was charged, split into goods and delivery, with the
 * VAT inside it once the shop is registered. Out: the postage on its labels
 * and the fulfilment company's charge per package. What is left is "after
 * shipping costs" — not profit: product cost and card fees are not recorded.
 *
 * Every cost lands on the day the order was paid for, so a day's costs sit
 * against that day's takings. Pure: the caller loads the orders, rates and
 * settings (lib/finance/query.ts), so the rules are testable on their own.
 */

export interface LedgerShipment {
  status: string; // PENDING | CREATED | FAILED | VOIDED
  environment: string; // "uat" | "live"
  serviceCode: string;
  createdAt: Date;
}

export interface LedgerOrder extends TakingsOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  items: string;
  paidAt: Date | null;
  createdAt: Date;
  shipments: LedgerShipment[];
}

export interface LedgerContext {
  rates: readonly Rate[];
  /** The VAT registration day, or null/"" while not registered. */
  vatFrom: string | null;
  /** Each customer's first sold order id, by lower-cased email (firstOrders). */
  firstOrderByEmail: ReadonlyMap<string, string>;
}

/**
 * Whether the order's postage is known.
 *  - label:    every live label is priced
 *  - pending:  a label is being bought and may or may not exist
 *  - no_label: no live label — not bought yet, or sent some other way
 *  - no_rate:  a label's service has no price on /admin/finance/costs
 */
export type PostageStatus = "label" | "pending" | "no_label" | "no_rate";

export type CustomerKind = "new" | "returning" | "unknown";

export interface LedgerRow {
  id: string;
  /** sale | plan_box | plan_upgrade (lib/plans/kinds.ts). */
  kind: OrderKind;
  /** The UK day it was paid for. */
  day: string;
  saleTime: Date;
  status: string;
  cancelled: boolean;
  customerName: string;
  customerEmail: string;
  takenMinor: number;
  goodsMinor: number;
  deliveryMinor: number;
  deliveryOption: string | null;
  /** Promotion codes taken off, or null on orders from before the amount charged was recorded. */
  discountMinor: number | null;
  /** The VAT inside takenMinor: 0 before registration and on cancelled orders. */
  vatMinor: number;
  /** The priced labels' postage. Counted on cancelled orders too: it was paid. */
  postageMinor: number;
  postageStatus: PostageStatus;
  /** Service codes on this order's live labels with no price. */
  unpricedServices: string[];
  packages: number;
  fulfilmentMinor: number;
  /** takenMinor less VAT, postage and fulfilment; a cancelled order's is minus its postage. */
  afterCostsMinor: number;
  vials: number;
  welcomeVials: number;
  /** BUNDLES id, a retired pack's name, or "loose" (orders from before packs). */
  pack: string;
  customer: CustomerKind;
  itemsUnreadable: boolean;
  /** The amounts disagree: charged more than goods plus delivery. */
  discountOdd: boolean;
}

interface ItemLine {
  qty?: unknown;
  welcome?: unknown;
  bundleId?: unknown;
  bundleName?: unknown;
}

function readItems(json: string): { lines: ItemLine[]; unreadable: boolean } {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) return { lines: parsed as ItemLine[], unreadable: false };
  } catch {
    // Fall through: counted as a warning rather than breaking the page.
  }
  return { lines: [], unreadable: true };
}

/** Which pack an order bought: its first line that is not the free welcome vial. */
function packOf(lines: ItemLine[]): string {
  const line = lines.find((l) => l.welcome !== true);
  if (!line) return "loose";
  if (typeof line.bundleId === "string" && line.bundleId) return line.bundleId;
  if (typeof line.bundleName === "string" && line.bundleName) return line.bundleName;
  return "loose";
}

export function ledgerRow(order: LedgerOrder, ctx: LedgerContext): LedgerRow {
  const at = saleTime(order);
  const day = shopDayKey(at);
  const cancelled = order.status === "cancelled";

  const kind = orderKind(order.kind);
  const takenMinor = kind === "plan_box" ? 0 : paidMinor(order);
  const delivery = order.deliveryMinor ?? 0;
  const goods = goodsMinor(order);

  let discountMinor: number | null = null;
  let discountOdd = false;
  if (order.amountPaidMinor !== null) {
    const listMinor = Math.round(Number(order.totalAmount.toString()) * 100) + delivery;
    const off = listMinor - order.amountPaidMinor;
    discountOdd = off < 0;
    discountMinor = Math.max(0, off);
  }

  // UAT labels are tests and cost nothing; voided and failed ones are not charged.
  const live = order.shipments.filter((s) => s.environment === "live");
  const labels = live.filter((s) => s.status === "CREATED");
  const pending = live.some((s) => s.status === "PENDING");
  let postageMinor = 0;
  const unpricedServices: string[] = [];
  for (const s of labels) {
    // Priced on the day it was bought: that is when the money went.
    const price = rateOn(ctx.rates, "postage", s.serviceCode, shopDayKey(s.createdAt));
    if (price === null) unpricedServices.push(s.serviceCode);
    else postageMinor += price;
  }
  const postageStatus: PostageStatus = pending
    ? "pending"
    : labels.length === 0
      ? "no_label"
      : unpricedServices.length > 0
        ? "no_rate"
        : "label";

  // One package per label; an order sent without a label still went out once.
  const packages = cancelled || kind === "plan_upgrade" ? 0 : Math.max(1, labels.length);
  const fulfilmentMinor = packages * fulfilmentRateOn(ctx.rates, day);
  const vatMinor = !cancelled && vatApplies(ctx.vatFrom, day) ? vatInside(goods) + vatInside(delivery) : 0;

  const { lines, unreadable } = readItems(order.items);
  let vials = 0;
  let welcomeVials = 0;
  for (const l of lines) {
    const qty = typeof l.qty === "number" ? l.qty : 0;
    vials += qty;
    if (l.welcome === true) welcomeVials += qty;
  }

  const email = order.customerEmail.trim().toLowerCase();
  const customer: CustomerKind = kind !== "sale" || !email
    ? "unknown"
    : ctx.firstOrderByEmail.get(email) === order.id
      ? "new"
      : "returning";

  return {
    id: order.id,
    kind,
    day,
    saleTime: at,
    status: order.status,
    cancelled,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    takenMinor,
    goodsMinor: goods,
    deliveryMinor: delivery,
    deliveryOption: order.deliveryOption,
    discountMinor,
    vatMinor,
    postageMinor,
    postageStatus,
    unpricedServices,
    packages,
    fulfilmentMinor,
    afterCostsMinor: cancelled ? -postageMinor : takenMinor - vatMinor - postageMinor - fulfilmentMinor,
    vials,
    welcomeVials,
    pack: packOf(lines),
    customer,
    itemsUnreadable: unreadable,
    discountOdd,
  };
}

/**
 * Each customer's first sold order, keyed by lower-cased email: the order
 * that makes them "new". Cancelled and unpaid orders are not passed in, so
 * they never count as anyone's first.
 */
export function firstOrders(
  orders: { id: string; customerEmail: string; paidAt: Date | null; createdAt: Date }[]
): Map<string, string> {
  const first = new Map<string, { id: string; at: number }>();
  for (const o of orders) {
    const email = o.customerEmail.trim().toLowerCase();
    if (!email) continue;
    const at = saleTime(o).getTime();
    const seen = first.get(email);
    if (!seen || at < seen.at || (at === seen.at && o.id < seen.id)) first.set(email, { id: o.id, at });
  }
  return new Map([...first].map(([email, v]) => [email, v.id]));
}

// ── Adding up

export interface FinanceTotals {
  orders: number;
  takenMinor: number;
  goodsMinor: number;
  deliveryMinor: number;
  discountMinor: number;
  vatMinor: number;
  postageMinor: number;
  packages: number;
  fulfilmentMinor: number;
  /** Postage on labels still live on cancelled orders: paid, with nothing sold. */
  cancelledLabelMinor: number;
  afterCostsMinor: number;
  /** takenMinor / orders, or 0 with no orders. */
  averageMinor: number;
  vials: number;
  welcomeVials: number;
  cancelledOrders: number;
  cancelledMinor: number;
}

export function summarise(rows: readonly LedgerRow[]): FinanceTotals {
  const t: FinanceTotals = {
    orders: 0,
    takenMinor: 0,
    goodsMinor: 0,
    deliveryMinor: 0,
    discountMinor: 0,
    vatMinor: 0,
    postageMinor: 0,
    packages: 0,
    fulfilmentMinor: 0,
    cancelledLabelMinor: 0,
    afterCostsMinor: 0,
    averageMinor: 0,
    vials: 0,
    welcomeVials: 0,
    cancelledOrders: 0,
    cancelledMinor: 0,
  };
  for (const r of rows) {
    if (r.cancelled) {
      t.cancelledOrders += r.kind === "sale" ? 1 : 0;
      t.cancelledMinor += r.takenMinor;
      t.cancelledLabelMinor += r.postageMinor;
      t.afterCostsMinor -= r.postageMinor;
      continue;
    }
    if (r.kind === "sale") t.orders += 1;
    t.takenMinor += r.takenMinor;
    t.goodsMinor += r.goodsMinor;
    t.deliveryMinor += r.deliveryMinor;
    t.discountMinor += r.discountMinor ?? 0;
    t.vatMinor += r.vatMinor;
    t.postageMinor += r.postageMinor;
    t.packages += r.packages;
    t.fulfilmentMinor += r.fulfilmentMinor;
    t.afterCostsMinor += r.afterCostsMinor;
    t.vials += r.vials;
    t.welcomeVials += r.welcomeVials;
  }
  if (t.orders > 0) t.averageMinor = Math.round(t.takenMinor / t.orders);
  return t;
}

// ── Grouping by day, week or month

export type Granularity = "day" | "week" | "month";

export interface Bucket {
  /** "2026-10-07", the Monday "2026-10-05", or "2026-10". */
  key: string;
  label: string;
  /** The first and last days of the range inside this bucket. */
  from: string;
  to: string;
  totals: FinanceTotals;
}

function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === "week") return weekKey(day);
  if (granularity === "month") return monthKey(day);
  return day;
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "month") return formatMonth(key);
  const short = formatShopDayShort(key);
  // "Mon 5 Oct" → "w/c 5 Oct"
  return granularity === "week" ? `w/c ${short.replace(/^\S+ /, "")}` : short;
}

/** Every bucket from `from` to `to`, including the ones with no sales. */
export function bucket(rows: readonly LedgerRow[], from: string, to: string, granularity: Granularity): Bucket[] {
  const days = new Map<string, { from: string; to: string }>();
  for (const day of dayKeysBetween(from, to)) {
    const key = bucketKey(day, granularity);
    const span = days.get(key);
    if (span) span.to = day;
    else days.set(key, { from: day, to: day });
  }
  const byKey = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const key = bucketKey(r.day, granularity);
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...days].map(([key, span]) => ({
    key,
    label: bucketLabel(key, granularity),
    ...span,
    totals: summarise(byKey.get(key) ?? []),
  }));
}

// ── Mixes

export interface DeliveryMixLine {
  option: string | null;
  priceMinor: number;
  orders: number;
  chargedMinor: number;
  postageMinor: number;
  /** Orders on this line whose postage is not known yet. */
  postageUnknown: number;
  /** Delivery charged less postage paid: negative = delivery costs more than it brings in. */
  marginMinor: number;
}

/** Delivery by option and price — free next day apart from paid — with what the postage cost. */
export function deliveryMix(rows: readonly LedgerRow[]): DeliveryMixLine[] {
  const lines = new Map<string, DeliveryMixLine>();
  for (const r of rows) {
    if (r.cancelled || r.kind !== "sale") continue;
    const key = `${r.deliveryOption ?? ""}:${r.deliveryMinor}`;
    const line = lines.get(key) ?? {
      option: r.deliveryOption,
      priceMinor: r.deliveryMinor,
      orders: 0,
      chargedMinor: 0,
      postageMinor: 0,
      postageUnknown: 0,
      marginMinor: 0,
    };
    line.orders += 1;
    line.chargedMinor += r.deliveryMinor;
    line.postageMinor += r.postageMinor;
    if (r.postageStatus !== "label") line.postageUnknown += 1;
    line.marginMinor = line.chargedMinor - line.postageMinor;
    lines.set(key, line);
  }
  return [...lines.values()].sort(
    (a, b) => optionRank(a.option) - optionRank(b.option) || b.priceMinor - a.priceMinor
  );
}

export interface PackMixLine {
  pack: string;
  label: string;
  orders: number;
  vials: number;
  goodsMinor: number;
}

const packRank = (pack: string) => {
  const i = BUNDLES.findIndex((b) => b.id === pack);
  return i === -1 ? BUNDLES.length : i;
};

export function packName(pack: string): string {
  const bundle = BUNDLES.find((b) => b.id === pack);
  if (bundle) return bundle.vials === 1 ? "Single vial" : `${bundle.vials}-vial pack`;
  if (pack === "loose") return "Single vials (before packs)";
  return pack;
}

/** Orders, vials and goods by the pack bought, in the shop's order, smallest first. */
export function packMix(rows: readonly LedgerRow[]): PackMixLine[] {
  const lines = new Map<string, PackMixLine>();
  for (const r of rows) {
    if (r.cancelled || r.kind !== "sale") continue;
    const line = lines.get(r.pack) ?? { pack: r.pack, label: packName(r.pack), orders: 0, vials: 0, goodsMinor: 0 };
    line.orders += 1;
    line.vials += r.vials;
    line.goodsMinor += r.goodsMinor;
    lines.set(r.pack, line);
  }
  return [...lines.values()].sort((a, b) => packRank(a.pack) - packRank(b.pack) || a.label.localeCompare(b.label));
}

export interface CustomerMixLine {
  kind: CustomerKind;
  orders: number;
  takenMinor: number;
}

export function customerMix(rows: readonly LedgerRow[]): CustomerMixLine[] {
  const order: CustomerKind[] = ["new", "returning", "unknown"];
  const lines = order.map((kind) => ({ kind, orders: 0, takenMinor: 0 }));
  for (const r of rows) {
    if (r.cancelled || r.kind !== "sale") continue;
    const line = lines[order.indexOf(r.customer)]!;
    line.orders += 1;
    line.takenMinor += r.takenMinor;
  }
  return lines.filter((l) => l.orders > 0);
}

// ── What the figures cannot see

export interface FinanceWarnings {
  /** Paid, no label yet: postage will be counted once one is bought. */
  awaitingLabel: LedgerRow[];
  /** Sent without a label bought here: postage never counted. */
  sentWithoutLabel: LedgerRow[];
  pendingLabel: LedgerRow[];
  /** Labels on services with no price, by service code. */
  unpriced: { serviceCode: string; rows: LedgerRow[] }[];
  /** Cancelled with a label still live: postage paid for nothing. */
  cancelledWithLabel: LedgerRow[];
  unreadableItems: LedgerRow[];
  discountOdd: LedgerRow[];
}

export function warnings(rows: readonly LedgerRow[]): FinanceWarnings {
  const sold = rows.filter((r) => !r.cancelled);
  const unpriced = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    for (const code of new Set(r.unpricedServices)) unpriced.set(code, [...(unpriced.get(code) ?? []), r]);
  }
  return {
    awaitingLabel: sold.filter((r) => r.kind !== "plan_upgrade" && r.postageStatus === "no_label" && r.status === "paid"),
    sentWithoutLabel: sold.filter((r) => r.kind !== "plan_upgrade" && r.postageStatus === "no_label" && r.status !== "paid"),
    pendingLabel: rows.filter((r) => r.postageStatus === "pending"),
    unpriced: [...unpriced].map(([serviceCode, rs]) => ({ serviceCode, rows: rs })),
    cancelledWithLabel: rows.filter(
      (r) => r.cancelled && (r.postageStatus === "label" || r.postageStatus === "no_rate")
    ),
    unreadableItems: rows.filter((r) => r.itemsUnreadable),
    discountOdd: sold.filter((r) => r.discountOdd),
  };
}
