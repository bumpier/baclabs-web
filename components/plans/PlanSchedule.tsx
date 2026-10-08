import Link from "next/link";
import type { Plan } from "@prisma/client";
import { brand } from "@/config/brand";
import { planScheduleSentences, planTermsOf } from "@/lib/plans/copy";
import { boxDueDay, freeBoxNumbers } from "@/lib/plans/schedule";
import { formatShopDay, shopDayKey } from "@/lib/saleTime";

/**
 * A plan's boxes and terms, on the order page of any order in it: box 1 (the
 * purchase, or the one-off order an upgrade claimed), a later box, or an
 * upgrade's payment. Server component. Copy comes from lib/plans/copy.ts, so
 * the page and the emails say the same thing.
 */

export interface PlanBoxRow {
  id: string;
  planBox: number | null;
  status: string;
  /** When the box was made. Shown for boxes already made, so a skipped month never moves a past date. */
  paidAt?: Date | null;
}

const ref = (orderId: string) => orderId.slice(0, 8).toUpperCase();

/** Where a box that has been made has got to. */
function boxState(status: string): string {
  if (status === "delivered") return "delivered";
  if (status === "shipped") return "on its way";
  if (status === "cancelled") return "cancelled";
  return "being packed";
}

export function PlanSchedule({
  plan,
  boxes,
  currentOrderId,
}: {
  plan: Plan;
  boxes: PlanBoxRow[];
  currentOrderId: string;
}) {
  const made = new Map<number, PlanBoxRow>();
  for (const b of boxes) if (b.planBox !== null) made.set(b.planBox, b);
  const free = new Set(freeBoxNumbers(plan.months, plan.paidMonths));
  const cancelled = plan.status === "cancelled";
  // A cancelled plan lists only the boxes it sent.
  const numbers = Array.from({ length: plan.months }, (_, i) => i + 1).filter((n) => !cancelled || made.has(n));
  const reply = brand.contact.email ? `email ${brand.contact.email}` : "get in touch through our contact page";
  // The first sentence restates the dates listed above it.
  const sentences = planScheduleSentences(planTermsOf(plan), { reply }).slice(1);

  return (
    <section className="mt-10" aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="text-xl">
        Your monthly plan
      </h2>

      {numbers.length > 0 ? (
        <ol className="measure mt-4 space-y-2 text-base text-ink-soft">
          {numbers.map((n) => {
            const box = made.get(n);
            const day = box?.paidAt ? shopDayKey(box.paidAt) : plan.anchorDay ? boxDueDay(plan.anchorDay, n) : null;
            const isThis = box?.id === currentOrderId;
            // Box 1 of an upgrade is the customer's original order: name it, as the emails do.
            const state = box
              ? n === 1 && plan.source === "upgrade" && !isThis
                ? `your order ${ref(box.id)}`
                : boxState(box.status)
              : null;
            return (
              <li key={n} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span>
                  <span className="font-medium text-ink">
                    Box <span className="tabular">{n}</span>
                  </span>
                  {day ? (
                    <>
                      {" "}
                      &middot; <time dateTime={day}>{formatShopDay(day)}</time>
                    </>
                  ) : null}
                  {free.has(n) ? <> &middot; free</> : null}
                  {plan.bonusVials > 0 && n === plan.bonusBox ? (
                    <> &middot; with your free {plan.bonusVials}-vial pack</>
                  ) : null}
                </span>
                {isThis ? (
                  <span className="text-sm font-medium text-ink">this order</span>
                ) : box && state ? (
                  <Link href={`/order-confirmation/${box.id}`} className="link text-sm">
                    {state}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {cancelled ? (
        <p className="measure mt-4 text-base text-ink-soft">
          This plan was cancelled
          {plan.cancelledAt ? <> on {formatShopDay(shopDayKey(plan.cancelledAt))}</> : null}. No more boxes will be sent.
        </p>
      ) : (
        <ul className="measure mt-6 space-y-3 text-sm text-ink-soft">
          {sentences.map((s) => (
            <li key={s} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-brand" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
