import type { Subscriber } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ctaButton, emailEnabled, escapeHtml, layout, sendBatch } from "@/lib/email";
import { marketingFooter, marketingHeaders } from "@/lib/customer-email";
import {
  bonusDeadlineText,
  previousOrderCount,
  welcomeEligible,
  welcomeLink,
  welcomeVialOn,
} from "@/lib/mailing-list";
import { brand } from "@/config/brand";
import { BUNDLES, MAILING_LIST } from "@/config/funnel";

// The emails that follow a signup whose welcome vial is still unused:
//
//   1. firstAfterHours after signup: "your free vial is still waiting".
//   2. secondAfterHours after that: the same, plus a bonus. A first order of
//      enough vials, placed before the date the email names, carries extra
//      free vials (lib/mailing-list.ts welcomeVialCount).
//
// Both stop the moment the subscriber orders or unsubscribes. Timings and
// the bonus are MAILING_LIST.reminders in config/funnel.ts; the cron route
// (app/api/cron/welcome-reminders/route.ts) calls runWelcomeReminders().

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Emails per run. The job runs every few minutes, so a backlog clears quickly. */
const MAX_PER_RUN = 50;

export type ReminderStep = 1 | 2;

export function remindersOn(): boolean {
  return welcomeVialOn() && MAILING_LIST.reminders.enabled;
}

/**
 * Which reminder this subscriber is due at `now`, or null. Pure, so the test
 * script can cover every branch. It reads only the subscriber: whether they
 * have ordered or opted out is the caller's check.
 */
export function reminderDue(
  sub: Pick<Subscriber, "status" | "welcomeOrderId" | "consentAt" | "welcomeReminder1At" | "welcomeReminder2At">,
  now: Date,
  on: boolean = remindersOn()
): ReminderStep | null {
  if (!on || sub.status !== "subscribed" || sub.welcomeOrderId) return null;
  const r = MAILING_LIST.reminders;
  const consent = sub.consentAt.getTime();
  const age = now.getTime() - consent;
  if (age > r.staleAfterDays * DAY) return null;

  if (!sub.welcomeReminder1At) return age >= r.firstAfterHours * HOUR ? 1 : null;
  if (sub.welcomeReminder2At) return null;
  // From the later of the two, so someone who unsubscribed after the first
  // reminder and signed up again is not sent the second the same day.
  const from = Math.max(sub.welcomeReminder1At.getTime(), consent);
  return now.getTime() - from >= r.secondAfterHours * HOUR ? 2 : null;
}

// ── The emails ─────────────────────────────────────────────────────

export interface ReminderEmail {
  subject: string;
  preheader: string;
  /** The message itself, before the shared layout wraps it. */
  body: string;
  html: string;
}

type Recipient = Pick<Subscriber, "id" | "email" | "welcomeBonusUntil">;

function firstReminder(sub: Recipient): Omit<ReminderEmail, "html"> {
  return {
    subject: "Your free vial is still waiting",
    preheader: "An extra 10ml vial, free with your first order.",
    body: `<p>Hi,</p>
      <p>You joined the ${escapeHtml(brand.name)} mailing list and have not used your free vial yet. It is still here: <strong>an extra 10ml vial, free with your first order</strong>.</p>
      <p>There is no code to enter. Use the button below and we add it to your order automatically. You will see it on the payment page before you pay.</p>
      <p style="margin:28px 0 0">${ctaButton(welcomeLink(sub.id), "Claim my free vial")}</p>
      ${marketingFooter(sub.email)}`,
  };
}

function secondReminder(sub: Recipient): Omit<ReminderEmail, "html"> {
  const { extraVials, minVials, validDays } = MAILING_LIST.reminders.bonus;
  const total = 1 + extraVials;
  const by = bonusDeadlineText(sub.welcomeBonusUntil ?? new Date(Date.now() + validDays * DAY));
  // The button lands on the pack that earns the bonus, when there is one.
  const pack = BUNDLES.find((b) => b.vials === minVials);
  return {
    subject: `${extraVials} extra free vials when you order ${minVials} or more`,
    preheader: `Until ${by}: ${total} free vials with a first order of ${minVials} or more.`,
    body: `<p>Hi,</p>
      <p>Your free vial is still waiting, and until ${by} we will add to it. Order ${minVials} vials or more and we include ${extraVials} more: <strong>${total} free vials with your first order</strong>.</p>
      <p>Smaller orders still come with the one free vial, and that has no end date.</p>
      <p>There is no code to enter. Use the button below and the vials are added automatically. You will see them on the payment page before you pay.</p>
      <p style="margin:28px 0 0">${ctaButton(welcomeLink(sub.id, pack?.id), pack ? `See the ${minVials}-vial pack` : "Choose your pack")}</p>
      ${marketingFooter(sub.email)}`,
  };
}

export function reminderEmail(step: ReminderStep, sub: Recipient): ReminderEmail {
  const copy = step === 1 ? firstReminder(sub) : secondReminder(sub);
  return { ...copy, html: layout(copy.body, { preheader: copy.preheader }) };
}

// ── Sending ────────────────────────────────────────────────────────

/**
 * Claim the reminder's slot, then send. The conditional update is the claim:
 * two runs that overlap cannot both send. A send that fails gives the slot
 * back, so the next run tries again, and the idempotency key stops that
 * retry becoming a second copy if the first one did in fact go.
 */
async function sendReminder(sub: Subscriber, step: ReminderStep, now: Date): Promise<"sent" | "failed" | "skipped"> {
  // A retry within the key's life (24 hours) reuses the date the first
  // attempt chose: the key only matches an email that is exactly the same.
  const fresh = new Date(now.getTime() + MAILING_LIST.reminders.bonus.validDays * DAY);
  const bonusUntil =
    sub.welcomeBonusUntil && fresh.getTime() - sub.welcomeBonusUntil.getTime() < DAY ? sub.welcomeBonusUntil : fresh;

  const free = step === 1 ? { welcomeReminder1At: null } : { welcomeReminder2At: null };
  const { count } = await prisma.subscriber.updateMany({
    where: { id: sub.id, status: "subscribed", welcomeOrderId: null, ...free },
    data: step === 1 ? { welcomeReminder1At: now } : { welcomeReminder2At: now, welcomeBonusUntil: bonusUntil },
  });
  if (count !== 1) return "skipped";

  const email = reminderEmail(step, { ...sub, welcomeBonusUntil: bonusUntil });
  const [result] = await sendBatch(
    [{ to: sub.email, subject: email.subject, html: email.html, headers: marketingHeaders(sub.email) }],
    `welcome-reminder:${step}:${sub.id}`
  );
  if (result?.ok) return "sent";

  await prisma.subscriber.updateMany({
    where: { id: sub.id, ...(step === 1 ? { welcomeReminder1At: now } : { welcomeReminder2At: now }) },
    data: free,
  });
  console.error(`[reminders] reminder ${step} to subscriber ${sub.id} failed`, result && !result.ok ? result.error : "");
  return "failed";
}

export interface ReminderRun {
  first: number;
  second: number;
  failed: number;
}

/** Send every reminder that is due. Called by the cron route; safe to overlap and to re-run. */
export async function runWelcomeReminders(now: Date = new Date()): Promise<ReminderRun> {
  const run: ReminderRun = { first: 0, second: 0, failed: 0 };
  if (!remindersOn()) return run;
  // Email switched off in production: sendBatch() would fail every send.
  if (!emailEnabled() && process.env.NODE_ENV === "production") return run;

  const r = MAILING_LIST.reminders;
  const candidates = await prisma.subscriber.findMany({
    where: {
      status: "subscribed",
      welcomeOrderId: null,
      welcomeReminder2At: null,
      consentAt: {
        gte: new Date(now.getTime() - r.staleAfterDays * DAY),
        lte: new Date(now.getTime() - Math.min(r.firstAfterHours, r.secondAfterHours) * HOUR),
      },
    },
    orderBy: { consentAt: "asc" },
  });

  for (const sub of candidates) {
    if (run.first + run.second + run.failed >= MAX_PER_RUN) break;
    const step = reminderDue(sub, now);
    if (!step) continue;
    try {
      // EmailOptOut is what every marketing sender checks.
      if (await prisma.emailOptOut.findUnique({ where: { email: sub.email } })) continue;
      // Ordered without the vial (an existing customer who then signed up).
      if (!welcomeEligible(sub, await previousOrderCount(sub.email))) continue;

      const outcome = await sendReminder(sub, step, now);
      if (outcome === "failed") run.failed++;
      else if (outcome === "sent" && step === 1) run.first++;
      else if (outcome === "sent") run.second++;
    } catch (err) {
      console.error(`[reminders] subscriber ${sub.id} failed`, err);
      run.failed++;
    }
  }
  return run;
}
