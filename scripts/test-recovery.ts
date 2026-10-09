/**
 * Test suite for abandoned-checkout recovery (lib/payments/recovery.ts):
 * who is emailed, which pending orders the clear-up keeps, where the email's
 * button sends people, and the email itself. Run with `npm run test:recovery`.
 * Exits non-zero on any failure. No database: the rules are pure, and the
 * email is rendered through the dev transport (no RESEND_API_KEY).
 */
import type { Order } from "@prisma/client";
import { bundleById, priceOrder } from "@/config/funnel";
import { buildOrderItems } from "@/lib/order-items";
import { welcomeItem } from "@/lib/mailing-list";
import { recoveryRecipient, resumeTarget, type ResumableOrder } from "@/lib/payments/recovery";
import { abandonedVerdict } from "@/lib/payments/abandoned";
import { sendCheckoutRecoveryEmail } from "@/lib/customer-email";
import { checkCompliance } from "@/lib/content-rules";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

async function main() {
  // ── Who is emailed ──────────────────────────────────────────────────
  const sub = { email: " Sam@Example.TEST ", status: "subscribed" };
  const base = { subscriber: sub, optedOut: false, paidSince: false, laterCheckout: false, recentlyEmailed: false };
  const to = recoveryRecipient(base);
  check("a subscriber is emailed, address normalised", "to" in to && to.to === "sam@example.test", JSON.stringify(to));
  const skips: [string, Parameters<typeof recoveryRecipient>[0]][] = [
    ["no subscriber", { ...base, subscriber: null }],
    ["unsubscribed", { ...base, subscriber: { ...sub, status: "unsubscribed" } }],
    ["opted out", { ...base, optedOut: true }],
    ["ordered since", { ...base, paidSince: true }],
    ["later checkout", { ...base, laterCheckout: true }],
    ["emailed recently", { ...base, recentlyEmailed: true }],
  ];
  for (const [name, input] of skips) check(`not emailed: ${name}`, "skip" in recoveryRecipient(input));

  // ── The clear-up keeps an order while its link can be paid ─────────
  const now = new Date("2026-10-09T12:00:00Z");
  const hour = 60 * 60 * 1000;
  const pending = {
    id: "o1",
    paymentProvider: "stripe",
    paymentRef: "cs_live_abc",
    notes: null,
    createdAt: new Date(now.getTime() - 48 * hour),
  };
  const expired = async () => "expired" as const;
  check("not emailed: an expired session clears", (await abandonedVerdict(pending, now, expired)).clear);
  const emailed = { ...pending, recoveryEmailSentAt: new Date(now.getTime() - 47 * hour), recoveryExpiresAt: new Date(now.getTime() + 29 * 24 * hour) };
  const v1 = await abandonedVerdict(emailed, now, expired);
  check("emailed, link open: kept", !v1.clear && v1.reason === "recovery link still open", JSON.stringify(v1));
  const lapsed = { ...emailed, recoveryExpiresAt: new Date(now.getTime() - 26 * hour) };
  check("emailed, link lapsed a day ago: clears", (await abandonedVerdict(lapsed, now, expired)).clear);
  const justLapsed = { ...emailed, recoveryExpiresAt: new Date(now.getTime() - 2 * hour) };
  check("emailed, link just lapsed: kept for a copy opened on its last day", !(await abandonedVerdict(justLapsed, now, expired)).clear);

  // ── Where the button goes ───────────────────────────────────────────
  const ten = bundleById("ten")!;
  const priced = priceOrder(ten, 1, 1)!;
  const items = JSON.stringify([
    ...buildOrderItems({ productId: "p", slug: "baclab-10ml", bundle: ten, quantity: 1, priced, goodsUsd: "52.00" }),
    welcomeItem("p", "baclab-10ml", 1),
  ]);
  const created = new Date("2026-10-07T09:00:00Z"); // Wed 10am UK, before the 3pm cutoff
  const order: ResumableOrder = {
    id: "ord-1",
    status: "pending",
    items,
    totalAmount: (priced.goodsMinor / 100).toFixed(2),
    createdAt: created,
    recoveryUrl: "https://buy.stripe.com/r/live_x",
    recoveryExpiresAt: new Date(created.getTime() + 30 * 24 * hour),
  };
  const sameMorning = new Date("2026-10-07T09:40:00Z");
  const fresh = "/?pack=ten&extra=1#buy";
  for (const choice of ["on", "off"]) {
    process.env.NEXT_PUBLIC_DELIVERY_CHOICE = choice;
    const at = `[${choice}]`;
    check(`${at} no order: the buy box`, resumeTarget({ order: null, newerPaidOrder: false, now: sameMorning }) === "/#buy");
    check(
      `${at} paid already: its confirmation`,
      resumeTarget({ order: { ...order, status: "paid" }, newerPaidOrder: false, now: sameMorning }) === "/order-confirmation/ord-1"
    );
    check(`${at} bought again since: the buy box`, resumeTarget({ order, newerPaidOrder: true, now: sameMorning }) === "/#buy");
    check(`${at} same morning: Stripe's link`, resumeTarget({ order, newerPaidOrder: false, now: sameMorning }) === order.recoveryUrl);
    check(
      `${at} no link stored: the same order in the buy box`,
      resumeTarget({ order: { ...order, recoveryUrl: null }, newerPaidOrder: false, now: sameMorning }) === fresh
    );
    check(
      `${at} link expired: the same order in the buy box`,
      resumeTarget({ order, newerPaidOrder: false, now: new Date(created.getTime() + 31 * 24 * hour) }) === fresh
    );
    check(
      `${at} re-priced since: the same order in the buy box`,
      resumeTarget({ order: { ...order, totalAmount: "39.99" }, newerPaidOrder: false, now: sameMorning }) === fresh
    );
  }
  // After the cutoff the copied session's next-day date is a day out.
  const afterCutoff = new Date("2026-10-07T15:30:00Z");
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "on";
  check("[on] next-day date moved on: a fresh checkout", resumeTarget({ order, newerPaidOrder: false, now: afterCutoff }) === fresh);
  process.env.NEXT_PUBLIC_DELIVERY_CHOICE = "off";
  check("[off] no date to go stale: Stripe's link", resumeTarget({ order, newerPaidOrder: false, now: afterCutoff }) === order.recoveryUrl);

  // ── The email ───────────────────────────────────────────────────────
  delete process.env.RESEND_API_KEY;
  const logged: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => logged.push(a.join(" "));
  const sent = await sendCheckoutRecoveryEmail(
    { ...(order as unknown as Order), totalAmount: order.totalAmount } as Order,
    "sam@example.test",
    new Date("2026-11-06T09:00:00Z")
  );
  console.log = log;
  const mail = logged.join("\n");
  const text = mail.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  check("email: reports sent", sent);
  check("email: to the subscriber", mail.includes("to=sam@example.test"), mail.slice(0, 120));
  check("email: names the vials in the subject", mail.includes('subject="Your 11 vials are still in your basket"'), mail.split("\n")[0]);
  check("email: says nothing was charged", text.includes("nothing has been charged"));
  check("email: the basket and its price", text.includes("10-vial pack + 1 single vial") && text.includes("£40.98"), text);
  check("email: mentions the welcome vial it carries", text.includes("your free welcome vial"));
  check("email: button through the resume route", mail.includes("/api/checkout/resume?o=ord-1"));
  check("email: states when the link stops", /works until \w+day \d+ November 2026/.test(text), text);
  check("email: unsubscribe link", mail.includes("/api/email/unsubscribe?email=sam%40example.test"));
  check("email: no discount offered", !/\b(code|discount|% off)\b/i.test(text));
  const violations = checkCompliance([text]);
  check("email: passes the content rules", violations.length === 0, JSON.stringify(violations.slice(0, 3)));

  if (failures > 0) {
    console.error(`\n${failures} recovery check(s) failed.`);
    process.exit(1);
  }
  console.log("Recovery checks passed.");
}

main();
