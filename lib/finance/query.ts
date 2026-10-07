import { prisma } from "@/lib/db";
import { SOLD_STATUSES, takingsWhere } from "@/lib/dailyTakings";
import {
  bucket,
  customerMix,
  deliveryMix,
  firstOrders,
  ledgerRow,
  packMix,
  summarise,
  warnings,
} from "@/lib/finance/ledger";
import { granularityFor, previousRange, type DayRange } from "@/lib/finance/range";
import { readSetting, SETTING_KEYS } from "@/lib/settings";
import { daysInRange, parseDayKey, shopRangeBounds } from "@/lib/saleTime";

/** The VAT registration day, or null while the shop is not registered. */
export async function vatRegisteredFrom(): Promise<string | null> {
  return parseDayKey((await readSetting(SETTING_KEYS.vatRegisteredFrom)) ?? undefined);
}

/**
 * Everything /admin/finance shows for the UK days `from` to `to`, and the
 * same figures for the period before when `compare` is set. One order query
 * covers both periods; the split is done here.
 */
export async function loadFinance(from: string, to: string, { compare }: { compare: boolean }) {
  const previous: DayRange | null = compare ? previousRange({ from, to }) : null;
  const { start, end } = shopRangeBounds(previous?.from ?? from, to);

  const [orders, rates, vatFrom, sold, services] = await Promise.all([
    prisma.order.findMany({
      where: takingsWhere(start, end),
      include: { shipments: { select: { status: true, environment: true, serviceCode: true, createdAt: true } } },
    }),
    prisma.costRate.findMany(),
    vatRegisteredFrom(),
    // Every sold order's email, to tell a first order from a repeat one.
    // Small: one short row per order the shop has ever sold.
    prisma.order.findMany({
      where: { status: { in: SOLD_STATUSES }, customerEmail: { not: "" } },
      select: { id: true, customerEmail: true, paidAt: true, createdAt: true },
    }),
    prisma.postalService.findMany({ select: { code: true, name: true } }),
  ]);

  const ctx = { rates, vatFrom, firstOrderByEmail: firstOrders(sold) };
  const all = orders.map((o) => ledgerRow(o, ctx)).sort((a, b) => a.saleTime.getTime() - b.saleTime.getTime());
  const rows = all.filter((r) => r.day >= from && r.day <= to);
  const granularity = granularityFor(daysInRange(from, to));

  return {
    from,
    to,
    rows,
    totals: summarise(rows),
    previous: previous && {
      ...previous,
      totals: summarise(all.filter((r) => r.day >= previous.from && r.day <= previous.to)),
    },
    granularity,
    buckets: bucket(rows, from, to, granularity),
    delivery: deliveryMix(rows),
    packs: packMix(rows),
    customers: customerMix(rows),
    warnings: warnings(rows),
    vatFrom,
    serviceNames: new Map(services.map((s) => [s.code, s.name])),
  };
}

export type Finance = Awaited<ReturnType<typeof loadFinance>>;
