import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { formatMinor } from "@/config/funnel";
import { ActionForm } from "@/components/admin/ActionForm";
import { paidMinor } from "@/lib/meta-capi-event";
import { statusLabel } from "@/lib/order-status";
import { formatSaleDateTime, formatShopDay, shopDayKey } from "@/lib/saleTime";
import { refundBreakdown } from "@/lib/plans/refund";
import { boxDueDay, freeBoxNumbers } from "@/lib/plans/schedule";
import { cancelPlanAction, skipPlanMonthAction } from "../actions";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  active: "bg-brand-tint text-brand-deep",
  completed: "bg-brand text-white",
  cancelled: "bg-red-50 text-red-600",
  pending: "bg-line text-ink-soft",
};

const TAG = "ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep";

export default async function AdminPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminRole("ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) notFound();

  const [orders, purchaseOrder, originalOrder] = await Promise.all([
    prisma.order.findMany({
      where: { planId: plan.id },
      orderBy: [{ planBox: "asc" }, { createdAt: "asc" }],
    }),
    prisma.order.findUnique({ where: { id: plan.purchaseOrderId } }),
    plan.upgradeOfOrderId ? prisma.order.findUnique({ where: { id: plan.upgradeOfOrderId } }) : null,
  ]);

  const byBox = new Map<number, (typeof orders)[number]>();
  for (const o of orders) if (o.planBox && !byBox.has(o.planBox)) byBox.set(o.planBox, o);
  // An upgraded plan's box 1 is the original one-off order.
  if (originalOrder && !byBox.has(1)) byBox.set(1, originalOrder);

  const free = freeBoxNumbers(plan.months, plan.paidMonths);
  const anchor = plan.anchorDay;
  const active = plan.status === "active";
  const refund = refundBreakdown({
    paidMinor: plan.paidMinor ?? 0,
    boxesSent: plan.boxesSent,
    boxPriceMinor: plan.boxPriceMinor,
    boxDeliveryMinor: plan.boxDeliveryMinor,
    bonusBox: plan.bonusBox,
    bonusValueMinor: plan.bonusValueMinor,
  });
  const systemCancelled = plan.cancelledBy.startsWith("system:");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/admin/plans" className="text-sm font-semibold text-brand hover:text-brand-deep">
        ← Monthly plans
      </Link>
      <p className="eyebrow mt-4">Plan detail</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight text-brand-deep">
          {plan.vialsPerBox} vials × {plan.months} months
        </h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${BADGE[plan.status] ?? ""}`}>
          {plan.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{plan.email || "No email"}</p>

      <section className="card mt-6 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Terms</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="label">Pack</dt>
            <dd>{plan.vialsPerBox} vials per box</dd>
          </div>
          <div>
            <dt className="label">Boxes</dt>
            <dd>
              {plan.months} boxes ({plan.paidMonths} paid, {plan.months - plan.paidMonths} free)
            </dd>
          </div>
          <div>
            <dt className="label">Box price</dt>
            <dd className="tabular">{formatMinor(plan.boxPriceMinor)}</dd>
          </div>
          <div>
            <dt className="label">Box delivery</dt>
            <dd className="tabular">{formatMinor(plan.boxDeliveryMinor)}</dd>
          </div>
          <div>
            <dt className="label">Bonus</dt>
            <dd>{plan.bonusVials > 0 ? `${plan.bonusVials}-vial pack in box ${plan.bonusBox}` : "None"}</dd>
          </div>
          <div>
            <dt className="label">Plan price</dt>
            <dd className="tabular">{formatMinor(plan.totalMinor)}</dd>
          </div>
          <div>
            <dt className="label">Paid</dt>
            <dd className="font-semibold tabular">{formatMinor(plan.paidMinor ?? 0)}</dd>
          </div>
          <div>
            <dt className="label">Source</dt>
            <dd className="capitalize">{plan.source}</dd>
          </div>
          <div>
            <dt className="label">Email</dt>
            <dd className="break-all">{plan.email || "—"}</dd>
          </div>
          <div>
            <dt className="label">Started</dt>
            <dd>{anchor ? formatShopDay(anchor) : "—"}</dd>
          </div>
          <div>
            <dt className="label">Next box</dt>
            <dd>{plan.nextBoxAt ? formatShopDay(shopDayKey(plan.nextBoxAt)) : "—"}</dd>
          </div>
          <div>
            <dt className="label">Renewal email handled</dt>
            <dd>{plan.renewalEmailSentAt ? formatSaleDateTime(plan.renewalEmailSentAt) : "Not yet"}</dd>
            <dd className="mt-1 text-xs text-ink-soft">
              Marked handled without sending when the customer has opted out of emails or has no address.
            </dd>
          </div>
          <div>
            <dt className="label">Status</dt>
            <dd className="capitalize">{plan.status}</dd>
          </div>
        </dl>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Boxes</h2>
        <ul className="mt-4 divide-y divide-line text-sm">
          {Array.from({ length: plan.months }, (_, i) => i + 1).map((n) => {
            const order = byBox.get(n);
            return (
              <li key={n} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">Box {n}</span>
                  {anchor && <span className="ml-2 text-ink-soft">{formatShopDay(boxDueDay(anchor, n))}</span>}
                  {free.includes(n) && <span className={TAG}>free</span>}
                  {n === plan.bonusBox && <span className={TAG}>bonus</span>}
                </span>
                {order ? (
                  <span>
                    <Link href={`/admin/orders/${order.id}`} className="link">
                      {order.id.slice(0, 8)}
                    </Link>{" "}
                    <span className="text-ink-soft">{statusLabel(order.status)}</span>
                  </span>
                ) : (
                  <span className="text-ink-soft">{plan.status === "cancelled" ? "Not sent" : "To come"}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mt-4 p-6 text-sm">
        <h2 className="font-display text-lg font-medium text-brand-deep">Payments</h2>
        <ul className="mt-3 space-y-1">
          {purchaseOrder && (
            <li>
              <Link href={`/admin/orders/${purchaseOrder.id}`} className="link">
                {purchaseOrder.id.slice(0, 8)}
              </Link>{" "}
              <span className="text-ink-soft">
                {plan.source === "upgrade" ? "upgrade payment" : "plan purchase (box 1)"}
              </span>{" "}
              <span className="font-medium tabular">{formatMinor(paidMinor(purchaseOrder))}</span>
            </li>
          )}
          {originalOrder && (
            <li>
              <Link href={`/admin/orders/${originalOrder.id}`} className="link">
                {originalOrder.id.slice(0, 8)}
              </Link>{" "}
              <span className="text-ink-soft">original order (box 1)</span>{" "}
              <span className="font-medium tabular">{formatMinor(paidMinor(originalOrder))}</span>
            </li>
          )}
        </ul>
      </section>

      {active && (
        <section className="card mt-4 p-6 text-sm">
          <h2 className="font-display text-lg font-medium text-brand-deep">Refund calculator</h2>
          <p className="mt-3">
            Paid {formatMinor(refund.paidMinor)} − {plan.boxesSent} {plan.boxesSent === 1 ? "box" : "boxes"} ×{" "}
            {formatMinor(plan.boxPriceMinor + plan.boxDeliveryMinor)} ({formatMinor(refund.boxesMinor)})
            {refund.bonusSent && (
              <>
                {" "}
                − free {plan.bonusVials}-pack sent ({formatMinor(refund.bonusMinor)})
              </>
            )}{" "}
            = <strong className="tabular">{formatMinor(refund.refundMinor)}</strong> to refund
          </p>
        </section>
      )}

      {active && (
        <section className="card mt-4 p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Cancel</h2>
          <ActionForm
            action={cancelPlanAction}
            submitLabel="Cancel plan and record refund"
            submitClassName="btn-secondary"
            confirm="Cancel this plan? No more boxes will be made."
            className="mt-4 space-y-4"
          >
            <input type="hidden" name="planId" value={plan.id} />
            {/* The refund above was worked out for this many boxes; the action refuses if another has gone since. */}
            <input type="hidden" name="boxesSent" value={plan.boxesSent} />
            <div>
              <label htmlFor="refund" className="label">
                Refund (£)
              </label>
              <input
                id="refund"
                name="refund"
                type="text"
                inputMode="decimal"
                defaultValue={(refund.refundMinor / 100).toFixed(2)}
                className="field mt-1 max-w-[10rem]"
              />
            </div>
            <p className="text-sm text-ink-soft">
              This stops the boxes and records the refund. It does not move money: refund the amount in Stripe
              (Payments → the payment → Refund).
            </p>
            {plan.source === "upgrade" && (
              <p className="text-sm text-ink-soft">
                This plan was an upgrade, paid in two payments (listed under Payments): refund from the upgrade
                payment and, if the refund is larger than that payment, the rest from the original order&rsquo;s
                payment.
              </p>
            )}
          </ActionForm>
        </section>
      )}

      {active && (
        <section className="card mt-4 p-6">
          <h2 className="font-display text-lg font-medium text-brand-deep">Skip a month</h2>
          <p className="mt-1 text-sm text-ink-soft">Moves every remaining box, and the renewal email, back one month.</p>
          <ActionForm
            action={skipPlanMonthAction}
            submitLabel="Skip a month"
            submitClassName="btn-secondary"
            confirm="Move every remaining box back one month?"
            className="mt-4 space-y-4"
          >
            <input type="hidden" name="planId" value={plan.id} />
          </ActionForm>
        </section>
      )}

      {plan.status === "cancelled" && (
        <section className="card mt-4 p-6 text-sm">
          <h2 className="font-display text-lg font-medium text-brand-deep">Cancelled</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="label">Cancelled at</dt>
              <dd>{plan.cancelledAt ? formatSaleDateTime(plan.cancelledAt) : "—"}</dd>
            </div>
            <div>
              <dt className="label">Refund recorded</dt>
              <dd className="tabular">{formatMinor(plan.refundMinor ?? 0)}</dd>
            </div>
            <div>
              <dt className="label">By</dt>
              <dd className={systemCancelled ? "" : "font-mono text-xs"}>{plan.cancelledBy || "—"}</dd>
            </div>
          </dl>
          {systemCancelled && (
            <p className="mt-4 text-ink-soft">
              The refund has not been made. Refund {formatMinor(plan.refundMinor ?? 0)} in Stripe (Payments → the
              payment → Refund).
            </p>
          )}
        </section>
      )}
    </div>
  );
}
