/**
 * A one-off apology for the October delays: one email per customer who paid
 * for a parcel from 1 Oct 2026, the day orders started going through the new
 * fulfilment (orders before that went out by hand). It says we're sorry, why
 * (far more orders than expected, just as fulfilment moved), that we've
 * caught up, and to email us if nothing has arrived by Monday 19 October.
 *
 * It is a service message about an order already bought, not marketing, so
 * it goes to customers who unsubscribed too, and it carries no offer and no
 * unsubscribe footer. Keep it that way: add a promotion and it becomes
 * marketing, which the opt-out list would then have to apply to.
 *
 * Each customer gets it once, however many orders they placed: before
 * sending, every one of their orders gets an EmailLog row of type
 * "delay_apology" (the unique orderId + type pair is the guard), and a
 * failed send removes them again so a re-run retries. A run killed between
 * the claim and the send leaves that customer marked sent; never double-send.
 *
 *   docker compose -f /srv/baclab/docker-compose.yml exec -T baclab \
 *     npx tsx scripts/send-delay-apology.ts [options]
 *
 *   (no options)          list who would get it, and send nothing
 *   --test you@example.com
 *                         send one copy, made out to the first customer on the
 *                         list, to this address only. Logs nothing.
 *   --html preview.html   write that same copy to a file
 *   --send                send it to everyone listed
 *   --limit N             send to at most N customers (the rest wait for a re-run)
 *   --skip-delivered      leave out customers whose every order has a delivery
 *                         date (a carrier scan or marked by hand)
 *   --from 2026-10-01     first UK day of payments included (default 2026-10-01)
 *   --before 2026-10-12   first UK day NOT included (default 2026-10-12, the
 *                         day fulfilment was back to normal)
 */
import { writeFileSync } from "node:fs";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { escapeHtml, layout, send } from "@/lib/email";
import { brand } from "@/config/brand";
import { LITERAL } from "@/lib/theme";
import { PARCEL_KINDS } from "@/lib/plans/kinds";
import { formatShopDay, parseDayKey, shiftDayKey, shopDayBounds, shopDayKey } from "@/lib/saleTime";

const TYPE = "delay_apology";
const SOLD = ["paid", "packed", "shipped", "delivered"];
/** The deadline the email gives. */
const CHASE_AFTER = "Monday 19 October";
/** Shown on the live site; the contact-form inbox (Cloudflare Email Routing). */
const CONTACT = brand.contact.email || "contact@baclab.co.uk";
/** Resend allows 2 requests a second by default. */
const GAP_MS = 600;

// ── Options ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]?.trim() : undefined;
};

const doSend = flag("--send");
const skipDelivered = flag("--skip-delivered");
const testTo = value("--test");
const htmlPath = value("--html");
const limit = Number(value("--limit")) || Infinity;
const fromDay = parseDayKey(value("--from") ?? "2026-10-01");
const beforeDay = parseDayKey(value("--before") ?? "2026-10-12");

if (!fromDay || !beforeDay || fromDay >= beforeDay) {
  console.error("--from and --before take dates (2026-10-01), and --from must come first.");
  process.exit(1);
}
if (testTo !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
  console.error("--test takes an email address.");
  process.exit(1);
}
if (doSend && testTo) {
  console.error("Use --test or --send, not both.");
  process.exit(1);
}

// ── Who gets it ─────────────────────────────────────────────────────

interface Recipient {
  /** As the customer typed it on their latest order. */
  to: string;
  firstName: string;
  orders: Order[];
}

async function recipients(): Promise<{ list: Recipient[]; alreadySent: number; skipped: number }> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: SOLD },
      kind: { in: PARCEL_KINDS },
      paidAt: { gte: shopDayBounds(fromDay!).start, lt: shopDayBounds(beforeDay!).start },
      customerEmail: { not: "" },
    },
    include: { emailLogs: { where: { type: TYPE }, select: { id: true } } },
    orderBy: { paidAt: "asc" },
  });

  const byEmail = new Map<string, (typeof orders)[number][]>();
  for (const o of orders) {
    const key = o.customerEmail.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), o]);
  }

  const list: Recipient[] = [];
  let alreadySent = 0;
  let skipped = 0;
  for (const group of byEmail.values()) {
    if (group.some((o) => o.emailLogs.length > 0)) {
      alreadySent++;
      continue;
    }
    if (skipDelivered && group.every((o) => o.deliveredAt)) {
      skipped++;
      continue;
    }
    const latest = group[group.length - 1]!;
    list.push({
      to: latest.customerEmail.trim(),
      firstName: latest.customerName.trim().split(/\s+/)[0]?.slice(0, 60) ?? "",
      orders: group.map(({ emailLogs: _logs, ...order }) => order),
    });
  }
  return { list, alreadySent, skipped };
}

// ── The email ───────────────────────────────────────────────────────

function apologyEmail(r: Pick<Recipient, "firstName" | "orders">): { subject: string; html: string } {
  const contactLink = `<a href="mailto:${escapeHtml(CONTACT)}" style="color:${LITERAL.brand}">${escapeHtml(CONTACT)}</a>`;
  const refs = r.orders.map((o) => o.id);
  return {
    subject: `Sorry for the wait on your ${brand.name} order`,
    html: layout(
      `<p>Hi ${escapeHtml(r.firstName || "there")},</p>
      <p>We're sorry for the delay with your order.</p>
      <p>Since the start of October we've had far more orders than we expected, just as we moved to a new fulfilment partner. The switch had some teething problems, and some parcels went out later than they should have.</p>
      <p><strong>We've now caught up, and your parcel should be with you this week.</strong> If it's already arrived, we're sorry it took longer than it should have.</p>
      <p>If it hasn't arrived by ${CHASE_AFTER}, email us at ${contactLink} with your order reference and we'll look into it straight away.</p>
      <p style="margin:0 0 20px;font-size:12px;color:${LITERAL.inkSoft}">Order reference${refs.length > 1 ? "s" : ""}: ${refs.join(", ")}</p>
      <p style="margin:0">Thank you for your patience,<br />The ${escapeHtml(brand.name)} team</p>`,
      { preheader: "We've caught up, and your parcel should be with you this week." }
    ),
  };
}

// ── Sending ─────────────────────────────────────────────────────────

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** False when this customer already has the email, from an earlier run. */
async function claim(r: Recipient): Promise<boolean> {
  try {
    await prisma.$transaction(
      r.orders.map((o) => prisma.emailLog.create({ data: { orderId: o.id, type: TYPE, recipient: r.to } }))
    );
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

async function release(r: Recipient): Promise<void> {
  await prisma.emailLog.deleteMany({ where: { type: TYPE, orderId: { in: r.orders.map((o) => o.id) } } });
}

/** send() never throws and returns Resend's id only when Resend took the email. */
async function deliver(to: string, email: { subject: string; html: string }): Promise<boolean> {
  const sent = await send(to, email.subject, email.html, { replyTo: CONTACT });
  return Boolean(sent?.id);
}

function requireResend(): void {
  const from = process.env.EMAIL_FROM ?? "";
  if (!process.env.RESEND_API_KEY || !from || from.includes("example.com")) {
    console.error("RESEND_API_KEY and EMAIL_FROM must be set, or nothing can be sent.");
    process.exit(1);
  }
}

// ── Run ─────────────────────────────────────────────────────────────

const short = (id: string) => id.slice(0, 8);

async function main() {
  const { list, alreadySent, skipped } = await recipients();
  const orderCount = list.reduce((n, r) => n + r.orders.length, 0);
  const delivered = list.filter((r) => r.orders.every((o) => o.deliveredAt)).length;

  console.log(`Orders paid ${formatShopDay(fromDay!)} to ${formatShopDay(shiftDayKey(beforeDay!, -1))}, UK time.`);
  console.log(`${list.length} customers to email (${orderCount} orders).`);
  if (delivered) console.log(`  ${delivered} with every order already marked delivered (--skip-delivered leaves them out).`);
  if (skipped) console.log(`  ${skipped} left out by --skip-delivered.`);
  if (alreadySent) console.log(`  ${alreadySent} already sent it on an earlier run, left out.`);
  console.log("");
  for (const r of list) {
    const orders = r.orders
      .map((o) => `${short(o.id)} ${shopDayKey(o.paidAt!)} ${o.deliveredAt ? "delivered" : o.status}`)
      .join("; ");
    console.log(`  ${r.to.padEnd(36)} ${(r.firstName || "(no name)").padEnd(14)} ${orders}`);
  }
  console.log("");

  const sample = apologyEmail(list[0] ?? { firstName: "Sam", orders: [{ id: "00000000-0000-0000-0000-000000000000" } as Order] });
  if (htmlPath) {
    writeFileSync(htmlPath, sample.html);
    console.log(`Wrote the email to ${htmlPath} (subject: "${sample.subject}").`);
  }

  if (testTo) {
    requireResend();
    const ok = await deliver(testTo, sample);
    console.log(ok ? `Sent a test copy to ${testTo}.` : `The test copy to ${testTo} failed; the error is above.`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (!doSend) {
    console.log("Nothing sent. Add --test you@example.com to see it, then --send to send it.");
    return;
  }

  requireResend();
  let sent = 0;
  let failed = 0;
  let raced = 0;
  for (const r of list.slice(0, limit)) {
    if (!(await claim(r))) {
      raced++;
      continue;
    }
    if (await deliver(r.to, apologyEmail(r))) {
      sent++;
    } else {
      await release(r);
      failed++;
      console.error(`  ✗ ${r.to}`);
    }
    await pause(GAP_MS);
  }
  const left = Math.max(0, list.length - limit);
  console.log(
    `Sent ${sent}.${failed ? ` ${failed} failed and can be retried by running --send again.` : ""}${
      raced ? ` ${raced} had already been sent by another run.` : ""
    }${left ? ` ${left} not tried (--limit).` : ""}`
  );
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
