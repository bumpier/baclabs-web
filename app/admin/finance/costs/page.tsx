import Link from "next/link";
import type { CostRate } from "@prisma/client";
import { requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { vatRegisteredFrom } from "@/lib/finance/query";
import { DEFAULT_FULFILMENT_MINOR, FROM_THE_START, VAT_RATE_PERCENT, rateOn } from "@/lib/finance/rates";
import { shopDayKey } from "@/lib/saleTime";
import { ActionForm } from "@/components/admin/ActionForm";
import { gbp, shortDay } from "@/components/admin/finance/parts";
import {
  deleteCostRateAction,
  saveFulfilmentRateAction,
  savePostageRateAction,
  saveVatAction,
} from "./actions";

export const dynamic = "force-dynamic";

const fromLabel = (day: string) => (day === FROM_THE_START ? "from the start" : `from ${shortDay(day)}`);

function RateFields({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-amount`} className="label">
          Price (£)
        </label>
        <input
          id={`${idPrefix}-amount`}
          name="amount"
          inputMode="decimal"
          placeholder="1.00"
          required
          className="field w-28"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-from`} className="label">
          From (blank = always)
        </label>
        <input id={`${idPrefix}-from`} name="from" type="date" className="field" />
      </div>
    </>
  );
}

/** Each price a cost has had, newest first, each removable. */
function History({ rates, today }: { rates: CostRate[]; today: string }) {
  if (rates.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {rates.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="tabular-nums">
            {gbp(r.amountMinor)} {fromLabel(r.effectiveFrom)}
            {r.effectiveFrom > today && <span className="ml-1 text-ink-soft">(not yet)</span>}
          </span>
          <ActionForm
            action={deleteCostRateAction}
            submitLabel="Remove"
            className="flex items-center gap-2"
            submitClassName="text-xs font-semibold text-red-600 hover:text-red-700"
            confirm={`Remove ${gbp(r.amountMinor)} ${fromLabel(r.effectiveFrom)}? Days it covered go back to the price before it.`}
          >
            <input type="hidden" name="id" value={r.id} />
          </ActionForm>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminCostsPage() {
  await requireAdminRole("ADMIN");
  const today = shopDayKey(new Date());

  const [rates, services, labelled, vatFrom] = await Promise.all([
    prisma.costRate.findMany({ orderBy: [{ effectiveFrom: "desc" }] }),
    prisma.postalService.findMany({ orderBy: [{ active: "desc" }, { priority: "asc" }, { name: "asc" }] }),
    // Services real labels were bought on, which may no longer be listed.
    prisma.shipment.groupBy({
      by: ["serviceCode", "serviceName"],
      where: { environment: "live", status: "CREATED" },
      _count: { _all: true },
    }),
    vatRegisteredFrom(),
  ]);

  const fulfilment = rates.filter((r) => r.kind === "fulfilment");
  const fulfilmentNow = rateOn(rates, "fulfilment", "", today);
  const labelCount = new Map<string, number>();
  for (const l of labelled) labelCount.set(l.serviceCode, (labelCount.get(l.serviceCode) ?? 0) + l._count._all);

  const listed = new Set(services.map((s) => s.code));
  const unlisted = new Map<string, string>();
  for (const l of labelled) {
    if (!listed.has(l.serviceCode) && !unlisted.has(l.serviceCode)) unlisted.set(l.serviceCode, l.serviceName);
  }
  const rows = [
    ...services.map((s) => ({
      code: s.code,
      name: s.name,
      detail: [s.carrier, s.deliveryOption === "next_day" ? "Next day" : s.deliveryOption === "standard" ? "Standard" : ""]
        .filter(Boolean)
        .join(" · "),
      active: s.active,
    })),
    ...[...unlisted].map(([code, name]) => ({ code, name: name || code, detail: "No longer listed", active: false })),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Finance</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-medium tracking-tight text-brand-deep">Costs</h1>
        <Link href="/admin/finance" className="btn-secondary">
          ← Finance
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-ink-soft">
        What it costs to send an order out. Each price has the day it starts, so a new price changes the days from
        then on and leaves earlier ones alone. Enter what you pay{vatFrom ? ", less any VAT you reclaim" : ""}.
      </p>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Fulfilment fee</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Charged per package. An order with two labels is two packages; a cancelled order is none.
        </p>
        <p className="mt-4 font-display text-2xl font-medium text-brand-deep">
          {gbp(fulfilmentNow ?? DEFAULT_FULFILMENT_MINOR)}{" "}
          <span className="font-sans text-sm text-ink-soft">
            per package{fulfilmentNow === null ? " (the default; no price saved)" : ""}
          </span>
        </p>
        <History rates={fulfilment} today={today} />
        <ActionForm
          action={saveFulfilmentRateAction}
          submitLabel="Save price"
          submitClassName="btn-secondary"
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <RateFields idPrefix="fulfilment" />
        </ActionForm>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Postage by service</h2>
        <p className="mt-1 text-sm text-ink-soft">
          What one label costs on each service, counted on every live label. Voided labels are taken to be
          refunded and cost nothing; test (UAT) labels are never counted. Services come from the{" "}
          <Link href="/admin/shipping" className="link">
            Shipping
          </Link>{" "}
          page.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No postal services yet. Sync them on the Shipping page.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {rows.map((s) => {
              const now = rateOn(rates, "postage", s.code, today);
              const used = labelCount.get(s.code) ?? 0;
              return (
                <li key={s.code} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {s.name}
                        {!s.active && <span className="ml-2 text-xs text-ink-soft">(inactive)</span>}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {[s.code, s.detail, used > 0 ? `${used} live label${used === 1 ? "" : "s"}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p
                      className={`tabular-nums ${
                        now === null ? "text-sm font-semibold text-red-600" : "font-semibold text-brand-deep"
                      }`}
                    >
                      {now === null ? "No price set" : `${gbp(now)} a label`}
                    </p>
                  </div>
                  <History rates={rates.filter((r) => r.kind === "postage" && r.key === s.code)} today={today} />
                  <ActionForm
                    action={savePostageRateAction}
                    submitLabel="Save price"
                    submitClassName="btn-secondary"
                    className="mt-3 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="serviceCode" value={s.code} />
                    <RateFields idPrefix={`postage-${s.code}`} />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">VAT</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {vatFrom
            ? `VAT registered from ${shortDay(vatFrom)}. From that day, the ${VAT_RATE_PERCENT}% VAT inside takings is taken off before costs.`
            : "Not VAT registered: takings carry no VAT."}{" "}
          Everything sold is treated as standard-rated. Once registered, add cost prices without the VAT you
          reclaim, starting from the registration day.
        </p>
        <ActionForm action={saveVatAction} submitLabel="Save" submitClassName="btn-secondary" className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="registered" defaultChecked={!!vatFrom} />
            VAT registered
          </label>
          <div>
            <label htmlFor="vatFrom" className="label">
              Registered from
            </label>
            <input id="vatFrom" name="vatFrom" type="date" defaultValue={vatFrom ?? ""} className="field" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
