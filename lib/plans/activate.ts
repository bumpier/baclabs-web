import type { Order, Prisma } from "@prisma/client";
import { paidMinor } from "@/lib/meta-capi-event";
import { orderKind } from "@/lib/plans/kinds";
import { boxDueAt } from "@/lib/plans/schedule";
import { shopDayKey } from "@/lib/saleTime";

/**
 * A plan goes live in the same transaction that marks its payment paid
 * (lib/payments/fulfillment.ts), so a paid plan can never be left pending.
 *
 *  - A plan's purchase order (kind "sale", planId set): box 1 is this order.
 *  - An upgrade payment (kind "plan_upgrade"): box 1 is the ORIGINAL one-off
 *    order, claimed here only while it is still in no plan. A second upgrade
 *    paid for the same order (two tabs) cannot take it: that plan is
 *    cancelled with its payment recorded as the refund due, and logged.
 */
const SOLD = ["paid", "packed", "shipped", "delivered"];

export type PlanActivation =
  | { outcome: "none" }
  | { outcome: "activated"; planId: string }
  | { outcome: "duplicate"; planId: string };

export async function activatePlanForPaidOrder(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "kind" | "planId" | "customerEmail">,
  paid: { at: Date; amountMinor: number }
): Promise<PlanActivation> {
  if (!order.planId) return { outcome: "none" };
  const kind = orderKind(order.kind);

  if (kind === "sale") {
    const anchorDay = shopDayKey(paid.at);
    const { count } = await tx.plan.updateMany({
      where: { id: order.planId, purchaseOrderId: order.id, status: "pending" },
      data: {
        status: "active",
        paidAt: paid.at,
        paidMinor: paid.amountMinor,
        boxesSent: 1,
        anchorDay,
        nextBoxAt: boxDueAt(anchorDay, 2),
        email: order.customerEmail,
      },
    });
    return count === 1 ? { outcome: "activated", planId: order.planId } : { outcome: "none" };
  }

  if (kind === "plan_upgrade") {
    const plan = await tx.plan.findUnique({ where: { id: order.planId } });
    if (!plan || plan.status !== "pending" || !plan.upgradeOfOrderId) return { outcome: "none" };
    const original = await tx.order.findUnique({ where: { id: plan.upgradeOfOrderId } });
    const claimed = original
      ? (
          await tx.order.updateMany({
            where: { id: original.id, planId: null, status: { in: SOLD } },
            data: { planId: plan.id, planBox: 1 },
          })
        ).count === 1
      : false;
    if (!original || !claimed) {
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          status: "cancelled",
          cancelledAt: paid.at,
          refundMinor: paid.amountMinor,
          cancelledBy: "system: the original order could not become box 1 (already in a plan, or cancelled). Refund this payment in Stripe.",
        },
      });
      console.error(
        `[internal] plan upgrade ${order.id} was paid but order ${plan.upgradeOfOrderId} could not become box 1. Refund ${paid.amountMinor}p in Stripe.`
      );
      return { outcome: "duplicate", planId: plan.id };
    }
    // Box 2 is due one month after the ORIGINAL order was paid.
    const anchorDay = shopDayKey(original.paidAt ?? original.createdAt);
    await tx.plan.update({
      where: { id: plan.id },
      data: {
        status: "active",
        paidAt: paid.at,
        paidMinor: paidMinor(original) + paid.amountMinor,
        boxesSent: 1,
        anchorDay,
        nextBoxAt: boxDueAt(anchorDay, 2),
        email: original.customerEmail,
      },
    });
    return { outcome: "activated", planId: plan.id };
  }

  return { outcome: "none" };
}
