import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, getAdminSession } from "@/lib/adminAuth";
import { formatPrice } from "@/config/brand";
import { Prisma } from "@prisma/client";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { PrintUnfulfilledMenu } from "@/components/admin/PrintUnfulfilledMenu";
import { LabelWarning } from "@/components/admin/LabelWarning";
import { TrackingWarning } from "@/components/admin/TrackingWarning";
import { catchUpCount } from "@/lib/shipping/catch-up";
import { statusLabel } from "@/lib/order-status";
import { SalesActivityChart } from "@/components/admin/SalesActivity";
import { buildSalesActivity } from "@/lib/salesActivity";
import { dailyTakings } from "@/lib/dailyTakings";
import { shopDayKey } from "@/lib/saleTime";
import type {
  DailyRevenue,
  StatusCount,
  ProductCount,
  PaymentMethod,
} from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const session = await getAdminSession();
  if (session?.role === "PACKER") redirect("/admin/orders");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Pending orders (checkouts never paid) are left out of everything here.
  const [
    stageGroups,
    oldOpenOrders,
    productCount,
    revenueOrders,
    allStatusGroups,
    allPaidOrders,
    paymentGroups,
    saleTimes,
    takingsToday,
  ] = await Promise.all([
    // Where every order has got to: paid (no label yet) → label created →
    // shipped → delivered. Tracking moves them on (lib/shipping/tracking-sync.ts).
    prisma.order.groupBy({
      by: ["status"],
      where: { status: { in: ["paid", "packed", "shipped", "delivered"] } },
      _count: { id: true },
    }),
    catchUpCount(),
    prisma.product.count({ where: { active: true } }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["paid", "packed", "shipped", "delivered"] },
      },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.order.groupBy({ by: ["status"], where: { status: { not: "pending" } }, _count: { id: true } }),
    prisma.order.findMany({
      where: { status: { in: ["paid", "packed", "shipped", "delivered"] } },
      select: { items: true },
    }),
    prisma.order.groupBy({ by: ["paymentMethod"], where: { status: { not: "pending" } }, _count: { id: true } }),
    prisma.order.findMany({
      where: {
        status: { in: ["paid", "packed", "shipped", "delivered"] },
        paidAt: { not: null },
      },
      select: { paidAt: true },
    }),
    dailyTakings(shopDayKey(new Date())),
  ]);

  const allOrdersAgg = await prisma.order.aggregate({
    where: { status: { in: ["paid", "packed", "shipped", "delivered"] } },
    _sum: { totalAmount: true },
  });
  const revenueDecimal = allOrdersAgg._sum?.totalAmount ?? new Prisma.Decimal(0);

  const stageCount = (status: string) => stageGroups.find((g) => g.status === status)?._count.id ?? 0;
  const unshippedOrders = stageCount("paid") + stageCount("packed");
  const stages = [
    { status: "paid", label: "Paid · needs a label", highlight: stageCount("paid") > 0 },
    { status: "packed", label: `${statusLabel("packed")} · waiting for the carrier`, highlight: false },
    { status: "shipped", label: statusLabel("shipped"), highlight: false },
    { status: "delivered", label: statusLabel("delivered"), highlight: false },
  ];

  const cards = [
    { label: "Taken today", value: formatPrice(takingsToday.summary.takenMinor / 100, "GBP"), href: "/admin/takings" },
    { label: "Revenue (GBP)", value: formatPrice(revenueDecimal.toString(), "GBP"), href: "/admin/orders" },
    { label: "Active products", value: String(productCount), href: "/admin/products" },
  ];

  // ── Analytics data
  const revenueByDate: Record<string, number> = {};
  for (const o of revenueOrders) {
    const key = o.createdAt.toISOString().split("T")[0]!;
    revenueByDate[key] = (revenueByDate[key] ?? 0) + Number(o.totalAmount);
  }
  const dailyRevenue: DailyRevenue[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0]!;
    const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    dailyRevenue.push({ date: label, revenue: Math.round(revenueByDate[key] ?? 0) });
  }

  const statusCounts: StatusCount[] = allStatusGroups.map((s) => ({
    status: s.status,
    count: s._count.id,
  }));

  const productCounts: Record<string, number> = {};
  for (const o of allPaidOrders) {
    try {
      const items = JSON.parse(o.items) as Array<{ name: string; qty: number }>;
      for (const item of items) {
        productCounts[item.name] = (productCounts[item.name] ?? 0) + (item.qty ?? 1);
      }
    } catch {
      // malformed items JSON — skip
    }
  }
  const topProducts: ProductCount[] = Object.entries(productCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const paymentMethods: PaymentMethod[] = paymentGroups.map((g) => ({
    name: g.paymentMethod,
    value: g._count.id,
  }));

  const totalRevenueGbp = Math.round(
    revenueOrders.reduce((sum: number, o: { totalAmount: unknown }) => sum + Number(o.totalAmount), 0)
  );

  const salesActivity = buildSalesActivity(
    saleTimes.flatMap((o) => (o.paidAt ? [o.paidAt] : [])),
    new Date()
  );

  const totalOrders = allStatusGroups.reduce(
    (sum: number, s: { _count: { id: number } }) => sum + s._count.id,
    0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Store overview</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Dashboard
      </h1>

      <LabelWarning />
      <TrackingWarning />

      {oldOpenOrders > 0 && (
        <p className="card mt-6 p-5 text-sm">
          <span className="font-semibold text-brand-deep">
            {oldOpenOrders} order{oldOpenOrders === 1 ? "" : "s"} sold more than 3 days ago still count as not shipped.
          </span>{" "}
          <Link href="/admin/shipping/catch-up" className="font-semibold text-brand hover:text-brand-deep">
            Catch up old orders →
          </Link>
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stages.map((s) => (
          <Link
            key={s.status}
            href={`/admin/orders?status=${s.status}`}
            className={`card p-5 transition-shadow hover:shadow-lift ${s.highlight ? "border-brand bg-brand-tint" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{stageCount(s.status)}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card p-5 transition-shadow hover:shadow-lift"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <PrintUnfulfilledMenu count={unshippedOrders} />
        <Link href="/admin/products/new" className="btn-primary">
          Add product
        </Link>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-xl font-medium text-brand-deep">Analytics</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Revenue chart shows the last 30 days and the sales-times chart has its own range. All
          other metrics are all-time.
        </p>
        <div className="mt-6">
          <SalesActivityChart activity={salesActivity} />
        </div>
        <div className="mt-6">
          <AnalyticsDashboard
            dailyRevenue={dailyRevenue}
            statusCounts={statusCounts}
            topProducts={topProducts}
            paymentMethods={paymentMethods}
            totalRevenueGbp={totalRevenueGbp}
            totalOrders={totalOrders}
          />
        </div>
      </div>
    </div>
  );
}
