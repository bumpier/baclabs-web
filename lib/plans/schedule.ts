import { RENEWAL_NOTICE_DAYS } from "@/config/plans";
import { shopDayBounds } from "@/lib/saleTime";

/**
 * When each box of a plan is due. Days are UK day keys ("2026-10-08", as in
 * lib/saleTime.ts). Every box is counted from the plan's ANCHOR day (the UK
 * day box 1 was paid for), never from the box before, so a plan started on
 * the 31st goes on the 28th/30th in short months and back to the 31st after.
 */

const DAY_MS = 86_400_000;

/** `dayKey` plus `months` calendar months, clamped to the end of a shorter month. */
export function addMonthsClamped(dayKey: string, months: number): string {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12; // 0-based
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The UK day box `boxNumber` (1-based) is due. Box 1 is the anchor day. */
export function boxDueDay(anchorDay: string, boxNumber: number): string {
  return addMonthsClamped(anchorDay, boxNumber - 1);
}

/** The moment box `boxNumber` falls due: UK midnight at the start of its day. */
export function boxDueAt(anchorDay: string, boxNumber: number): Date {
  return shopDayBounds(boxDueDay(anchorDay, boxNumber)).start;
}

export function lastBoxDay(anchorDay: string, months: number): string {
  return boxDueDay(anchorDay, months);
}

/** The Plan fields the schedule reads. A Prisma Plan row satisfies it. */
export interface PlanClock {
  status: string;
  months: number;
  boxesSent: number;
  anchorDay: string | null;
  nextBoxAt: Date | null;
  renewalEmailSentAt: Date | null;
}

/** Whether the next box should be made now. One box per plan per run. */
export function isBoxDue(plan: PlanClock, now: Date): boolean {
  return (
    plan.status === "active" &&
    plan.anchorDay !== null &&
    plan.boxesSent < plan.months &&
    plan.nextBoxAt !== null &&
    plan.nextBoxAt.getTime() <= now.getTime()
  );
}

/** The plan once box `boxNumber` has been made. */
export function afterBox(
  plan: { months: number; anchorDay: string },
  boxNumber: number
): { boxesSent: number; nextBoxAt: Date | null; status: "active" | "completed" } {
  const done = boxNumber >= plan.months;
  return {
    boxesSent: boxNumber,
    nextBoxAt: done ? null : boxDueAt(plan.anchorDay, boxNumber + 1),
    status: done ? "completed" : "active",
  };
}

/** The renewal email may go from 14 days before the last box until 14 days after it. */
export function renewalWindow(anchorDay: string, months: number): { from: Date; until: Date } {
  const last = boxDueAt(anchorDay, months).getTime();
  return {
    from: new Date(last - RENEWAL_NOTICE_DAYS * DAY_MS),
    until: new Date(last + RENEWAL_NOTICE_DAYS * DAY_MS),
  };
}

export function renewalDue(plan: PlanClock, now: Date): boolean {
  if (plan.status !== "active" && plan.status !== "completed") return false;
  if (plan.renewalEmailSentAt || !plan.anchorDay) return false;
  const { from, until } = renewalWindow(plan.anchorDay, plan.months);
  return now.getTime() >= from.getTime() && now.getTime() < until.getTime();
}

/** "Skip a month": every remaining box, and the renewal email, one month later. */
export function skipAMonth(plan: { anchorDay: string; boxesSent: number; months: number }): {
  anchorDay: string;
  nextBoxAt: Date | null;
} {
  const anchorDay = addMonthsClamped(plan.anchorDay, 1);
  return { anchorDay, nextBoxAt: plan.boxesSent < plan.months ? boxDueAt(anchorDay, plan.boxesSent + 1) : null };
}

/** "8th": the day of the month a plan's boxes go on, for copy. */
export function ordinalDay(dayKey: string): string {
  const d = Number(dayKey.slice(8, 10));
  const suffix =
    d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${d}${suffix}`;
}

/** The free months are the LAST boxes: 12 months paying 10 → boxes 11 and 12. */
export function freeBoxNumbers(months: number, paidMonths: number): number[] {
  return Array.from({ length: Math.max(0, months - paidMonths) }, (_, i) => paidMonths + i + 1);
}
