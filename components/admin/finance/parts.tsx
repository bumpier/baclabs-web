import Link from "next/link";
import { formatPrice } from "@/config/brand";
import { deliveryOptionById } from "@/config/funnel";
import type { FinanceWarnings, LedgerRow } from "@/lib/finance/ledger";

/**
 * Pieces shared by /admin/finance and /admin/takings: money, delivery names,
 * a figure card, and the warnings about costs the figures cannot see yet.
 */

export const gbp = (minor: number) => formatPrice(minor / 100, "GBP");
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** "7 Oct 2026", from "2026-10-07". */
export const shortDay = (dayKey: string) => dayFmt.format(new Date(`${dayKey}T12:00:00Z`));

/** "Next day, free" over "Amazon Shipping"; orders from before the choice by price alone. */
export function describeDelivery({ option, priceMinor }: { option: string | null; priceMinor: number }) {
  const known = deliveryOptionById(option);
  if (!option) {
    return { name: priceMinor > 0 ? "Flat rate" : "Free delivery", detail: "No option recorded" };
  }
  const label = known?.label ?? option;
  return { name: priceMinor > 0 ? label : `${label}, free`, detail: known?.carrier ?? "" };
}

export function Stat({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-5 ${highlight ? "border-brand bg-brand-tint" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium tabular-nums text-brand-deep sm:text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

const SHOWN = 6;

function OrderLinks({ rows }: { rows: LedgerRow[] }) {
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {rows.slice(0, SHOWN).map((r) => (
        <Link key={r.id} href={`/admin/orders/${r.id}`} className="link font-mono text-xs">
          {r.id.slice(0, 8)}
        </Link>
      ))}
      {rows.length > SHOWN && <span className="text-xs">and {rows.length - SHOWN} more</span>}
    </span>
  );
}

/** What the cost figures cannot see, each with the orders behind it. */
export function FinanceWarningsPanel({
  warnings: w,
  serviceNames,
}: {
  warnings: FinanceWarnings;
  serviceNames: ReadonlyMap<string, string>;
}) {
  const items: { key: string; text: React.ReactNode; rows: LedgerRow[] }[] = [];
  const orders = (n: number) => plural(n, "order");

  if (w.awaitingLabel.length) {
    items.push({
      key: "awaiting",
      text: `${orders(w.awaitingLabel.length)} ${w.awaitingLabel.length === 1 ? "has" : "have"} no label yet, so postage is not counted until one is bought.`,
      rows: w.awaitingLabel,
    });
  }
  if (w.pendingLabel.length) {
    items.push({
      key: "pending",
      text: `${orders(w.pendingLabel.length)} ${w.pendingLabel.length === 1 ? "has a label" : "have labels"} still being bought: postage not counted yet.`,
      rows: w.pendingLabel,
    });
  }
  for (const u of w.unpriced) {
    items.push({
      key: `unpriced-${u.serviceCode}`,
      text: (
        <>
          {plural(u.rows.length, "label")} on {serviceNames.get(u.serviceCode) ?? u.serviceCode} ({u.serviceCode}){" "}
          {u.rows.length === 1 ? "has" : "have"} no price, so the postage is missing.{" "}
          <Link href="/admin/finance/costs" className="link">
            Set a price
          </Link>
          .
        </>
      ),
      rows: u.rows,
    });
  }
  if (w.cancelledWithLabel.length) {
    const paid = w.cancelledWithLabel.reduce((sum, r) => sum + r.postageMinor, 0);
    items.push({
      key: "cancelled",
      text: `${orders(w.cancelledWithLabel.length)} cancelled with a label still live: ${gbp(paid)} of postage counted against takings. Void the label on the order if it was never used.`,
      rows: w.cancelledWithLabel,
    });
  }
  if (w.sentWithoutLabel.length) {
    items.push({
      key: "unlabelled",
      text: `${orders(w.sentWithoutLabel.length)} went out without a label bought here, so their postage is not counted.`,
      rows: w.sentWithoutLabel,
    });
  }
  if (w.unreadableItems.length) {
    items.push({
      key: "items",
      text: `${orders(w.unreadableItems.length)} could not be read: their vials and pack are left out of the counts.`,
      rows: w.unreadableItems,
    });
  }
  if (w.discountOdd.length) {
    items.push({
      key: "odd",
      text: `${orders(w.discountOdd.length)} charged more than goods plus delivery. Worth checking in Stripe.`,
      rows: w.discountOdd,
    });
  }
  if (items.length === 0) return null;

  return (
    <div className="alert-note mt-6">
      <p className="font-semibold">Some costs are not counted yet</p>
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.key}>
            {i.text}
            <OrderLinks rows={i.rows} />
          </li>
        ))}
      </ul>
    </div>
  );
}
