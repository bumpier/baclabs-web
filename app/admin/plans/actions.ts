"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { formatMinor } from "@/config/funnel";
import { parsePounds } from "@/lib/finance/rates";
import type { FormState } from "@/lib/form-state";
import { skipAMonth } from "@/lib/plans/schedule";

function revalidatePlan(id: string) {
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${id}`);
}

/**
 * Cancel a plan and record the refund. Stops every future box at once (the
 * cron only makes boxes for active plans). The money is NOT moved here:
 * there is no refund webhook, so the admin refunds the figure in Stripe by hand.
 */
export async function cancelPlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = String(formData.get("planId") ?? "");
  const refundMinor = parsePounds(String(formData.get("refund") ?? ""));
  if (refundMinor === null) return { error: "Enter the refund in pounds, e.g. 167.04 (0 for none)" };
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return { error: "Plan not found" };
  if (refundMinor > (plan.paidMinor ?? 0)) return { error: "The refund cannot be more than was paid for the plan" };
  const session = await getAdminSession();
  const { count } = await prisma.plan.updateMany({
    where: { id, status: "active" },
    data: { status: "cancelled", cancelledAt: new Date(), refundMinor, cancelledBy: session?.adminUserId ?? "admin", nextBoxAt: null },
  });
  if (count === 0) return { error: "Only an active plan can be cancelled. Refresh the page." };
  revalidatePlan(id);
  return { success: `Cancelled: no more boxes will be made. Now refund ${formatMinor(refundMinor)} in Stripe.` };
}

/** Move every remaining box (and the renewal email) back one month. */
export async function skipPlanMonthAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = String(formData.get("planId") ?? "");
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan || plan.status !== "active" || !plan.anchorDay) return { error: "Only an active plan can skip a month" };
  const next = skipAMonth({ anchorDay: plan.anchorDay, boxesSent: plan.boxesSent, months: plan.months });
  const { count } = await prisma.plan.updateMany({
    where: { id, status: "active", boxesSent: plan.boxesSent, anchorDay: plan.anchorDay },
    data: { anchorDay: next.anchorDay, nextBoxAt: next.nextBoxAt },
  });
  if (count === 0) return { error: "The plan changed while you were looking. Refresh the page." };
  revalidatePlan(id);
  return { success: "Done: every remaining box goes a month later." };
}
