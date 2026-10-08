import type { Plan } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { STANDARD_DELIVERY } from "@/config/funnel";
import { getInventoryMode } from "@/lib/inventory/mode";
import { allocateAfterPayment, takeStockInTransaction } from "@/lib/payments/stock";
import { autoBuyLabel } from "@/lib/shipping/shipments";
import { sendPlanRenewalEmail } from "@/lib/customer-email";
import { planBoxItems } from "@/lib/plans/items";
import { afterBox, isBoxDue, renewalDue } from "@/lib/plans/schedule";

/**
 * The later boxes of every prepaid plan, run daily by /api/cron/plan-boxes.
 *
 * Each due box becomes an Order that is ALREADY PAID (never pending: the
 * nightly clear-pending deletes unpaid orders) with totals 0 and kind
 * "plan_box". It takes stock exactly as a sale does (lib/payments/stock.ts)
 * and gets its label (autoBuyLabel), but it does NOT go through
 * fulfillPaidOrder: that would send a second confirmation email and a second
 * Meta Purchase, and run the welcome-vial logic.
 *
 * Idempotent: the plan's boxesSent is advanced with a conditional update in
 * the same transaction that creates the box, and Order has a unique
 * (planId, planBox). A re-run, or two runs at once, never make a box twice.
 * One box per plan per run: a cron that was down for a while catches up a
 * month at a time rather than sending two boxes in one day.
 */

export interface PlanBoxRun {
  due: number;
  created: number;
  skipped: number;
  failed: number;
}

export async function runPlanBoxes(now = new Date()): Promise<PlanBoxRun> {
  const plans = await prisma.plan.findMany({
    where: { status: "active", nextBoxAt: { lte: now } },
    orderBy: { nextBoxAt: "asc" },
  });
  const run: PlanBoxRun = { due: 0, created: 0, skipped: 0, failed: 0 };
  for (const plan of plans) {
    if (!isBoxDue(plan, now)) {
      run.skipped++;
      continue;
    }
    run.due++;
    try {
      if ((await createPlanBox(plan, now)) === "created") run.created++;
      else run.skipped++;
    } catch (err) {
      run.failed++;
      console.error(`[plans] box ${plan.boxesSent + 1} of plan ${plan.id} failed`, err);
    }
  }
  return run;
}

export async function createPlanBox(plan: Plan, now: Date): Promise<"created" | "skipped"> {
  const boxNumber = plan.boxesSent + 1;
  // Box 1 holds the address, the email and the product row: the purchase
  // order for a checkout plan, the original order for an upgrade.
  const first = await prisma.order.findFirst({ where: { planId: plan.id, planBox: 1 } });
  if (!first || !plan.anchorDay) {
    console.error(`[internal] plan ${plan.id} has no box 1 order or no anchor day; no box made`);
    return "skipped";
  }
  const template = (JSON.parse(first.items) as { productId: string; slug: string }[])[0];
  if (!template) return "skipped";

  const items = JSON.stringify(
    planBoxItems({
      productId: template.productId,
      slug: template.slug,
      packId: plan.packId,
      vialsPerBox: plan.vialsPerBox,
      boxNumber,
      months: plan.months,
      bonusBox: plan.bonusBox,
    })
  );
  const next = afterBox({ months: plan.months, anchorDay: plan.anchorDay }, boxNumber);
  const mode = await getInventoryMode();

  let orderId: string | null;
  try {
    orderId = await prisma.$transaction(async (tx) => {
      const { count } = await tx.plan.updateMany({
        where: { id: plan.id, status: "active", boxesSent: plan.boxesSent },
        data: { boxesSent: next.boxesSent, nextBoxAt: next.nextBoxAt, status: next.status },
      });
      if (count === 0) return null; // another run made it, or the plan was cancelled
      const order = await tx.order.create({
        data: {
          status: "paid",
          kind: "plan_box",
          planId: plan.id,
          planBox: boxNumber,
          customerName: first.customerName,
          customerEmail: first.customerEmail,
          customerPhone: first.customerPhone,
          shippingAddress: first.shippingAddress,
          deliveryInstructions: first.deliveryInstructions,
          items,
          currency: "GBP",
          totalAmount: new Prisma.Decimal(0),
          subtotalUsd: new Prisma.Decimal(0),
          amountPaidMinor: 0,
          paymentMethod: "plan",
          deliveryOption: STANDARD_DELIVERY.id,
          deliveryMinor: 0,
          paidAt: now,
          notes: `Box ${boxNumber} of ${plan.months}, monthly plan ${plan.id.slice(0, 8)}. Prepaid: nothing to charge.`,
        },
      });
      await takeStockInTransaction(tx, mode, items);
      return order.id;
    });
  } catch (err) {
    // The unique (planId, planBox) caught a box that already exists: the
    // whole transaction, the plan update included, rolled back.
    if ((err as { code?: string }).code === "P2002") return "skipped";
    throw err;
  }
  if (!orderId) return "skipped";

  await allocateAfterPayment(orderId, mode);
  await autoBuyLabel(orderId); // never throws; a failure shows in the admin label warning
  return "created";
}

export interface RenewalRun {
  due: number;
  sent: number;
  skipped: number;
}

/** The renewal email, 14 days before the last box. Claimed before sending, released if the send fails. */
export async function runPlanRenewals(now = new Date()): Promise<RenewalRun> {
  const plans = await prisma.plan.findMany({
    where: { status: { in: ["active", "completed"] }, renewalEmailSentAt: null, anchorDay: { not: null } },
  });
  const run: RenewalRun = { due: 0, sent: 0, skipped: 0 };
  for (const plan of plans) {
    if (!renewalDue(plan, now)) continue;
    run.due++;
    const { count } = await prisma.plan.updateMany({
      where: { id: plan.id, renewalEmailSentAt: null },
      data: { renewalEmailSentAt: now },
    });
    if (count === 0) {
      run.skipped++;
      continue;
    }
    const order = await prisma.order.findUnique({ where: { id: plan.purchaseOrderId } });
    const optedOut = order?.customerEmail
      ? await prisma.emailOptOut.findUnique({ where: { email: order.customerEmail.toLowerCase() } })
      : null;
    if (!order?.customerEmail || optedOut) {
      run.skipped++; // stays claimed: an opted-out customer is not asked again tomorrow
      continue;
    }
    if (await sendPlanRenewalEmail(plan, order)) run.sent++;
    else {
      await prisma.plan.updateMany({ where: { id: plan.id, renewalEmailSentAt: now }, data: { renewalEmailSentAt: null } });
      run.skipped++;
    }
  }
  return run;
}
