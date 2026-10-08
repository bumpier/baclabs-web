import { createHmac } from "node:crypto";
import type { Order, Plan, Subscriber } from "@prisma/client";
import { prisma } from "@/lib/db";
import { send, layout, escapeHtml, ctaButton } from "@/lib/email";
import { welcomeLink } from "@/lib/mailing-list";
import { canonicalOrigin } from "@/lib/site-url";
import { LITERAL } from "@/lib/theme";
import { brand, formatPrice, type Currency } from "@/config/brand";
import { formatSaleDateTime, saleTime } from "@/lib/saleTime";
import { orderKind } from "@/lib/plans/kinds";
import { boxDueDay } from "@/lib/plans/schedule";
import { nudgePlanPack, upgradeEligibility } from "@/lib/plans/upgrade";
import {
  boxShippedCopy, nudgePlanOfferHtml, planScheduleHtml, planStartedCopy, planTermsOf, renewalCopy, upgradeOfferHtml,
} from "@/lib/plans/copy";
import { isPlanMonths, isPlanPackId, planKey } from "@/config/plans";

// Customer-facing order emails. Every send is recorded in EmailLog first;
// the @@unique([orderId, type]) constraint makes double-sends impossible.
// Senders never throw — a Resend outage must not break a webhook or
// admin action. Callers fire-and-forget.

export type EmailType = "confirmation" | "shipped" | "delivered" | "nudge" | "review" | "plan_renewal";

interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  unitPriceUsd: string;
  /** Exact line total. Falls back to unitPrice × qty for orders placed before this field existed. */
  lineTotal?: string;
  /** The mailing-list welcome vial (lib/mailing-list.ts): shown as "Free". */
  welcome?: boolean;
  /** The free pack of a 12-month plan: shown as "Free". */
  planBonus?: boolean;
  /** "5-vial monthly plan, 12 boxes" on a plan's purchase line (lib/plans/items.ts). */
  bundleName?: string;
  /** "plan": box 1's line, which carries the whole plan's price. */
  planLine?: "plan" | "box" | "bonus";
}

// Order + nudge emails are sent from the payment webhook and the cron job —
// no request context — so they always use the stable canonical origin.
function siteUrl(): string {
  return canonicalOrigin();
}

/** HMAC-signed unsubscribe link — no token storage needed. Reuses JWT_SECRET. */
export function unsubscribeSig(email: string): string {
  return createHmac("sha256", process.env.JWT_SECRET ?? "")
    .update(email.toLowerCase())
    .digest("hex");
}

export function unsubscribeUrl(email: string): string {
  const e = email.toLowerCase();
  return `${siteUrl()}/api/email/unsubscribe?email=${encodeURIComponent(e)}&sig=${unsubscribeSig(e)}`;
}

/**
 * Headers every marketing email carries. Gmail and Yahoo require one-click
 * unsubscribe (RFC 8058) from bulk senders: the mail client POSTs
 * "List-Unsubscribe=One-Click" to the https URL, which the unsubscribe route
 * accepts. The mailto is a fallback for clients that only offer that.
 */
export function marketingHeaders(email: string): Record<string, string> {
  const links = [`<${unsubscribeUrl(email)}>`];
  if (brand.contact.email) links.push(`<mailto:${brand.contact.email}?subject=unsubscribe>`);
  return {
    "List-Unsubscribe": links.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** The line at the foot of every marketing email. */
export function marketingFooter(email: string): string {
  return `<p style="font-size:11px;color:${LITERAL.inkSoft};margin-top:28px">You are receiving this because you signed up to ${escapeHtml(brand.name)} emails or bought from us.
    <a href="${unsubscribeUrl(email)}" style="color:${LITERAL.inkSoft}">Unsubscribe</a></p>`;
}

/**
 * Sent once, on signup. Carries the welcome offer when it is switched on and
 * this person has not ordered yet; its button then goes through welcomeLink,
 * so the vial follows them to whichever device opens the email. The
 * reminders that follow are lib/welcome-reminders.ts. Never throws.
 */
export async function sendWelcomeEmail(
  sub: Pick<Subscriber, "id" | "email">,
  opts: { withOffer: boolean }
): Promise<void> {
  const { email } = sub;
  try {
    const offer = opts.withOffer
      ? `<p>As promised, your first order comes with <strong>an extra 10ml vial, free</strong>. There is no code to enter: use the button below, or check out with this email address (${escapeHtml(email)}), and we add it to your order automatically. You will see it on the payment page.</p>`
      : "";
    await send(
      email,
      offer ? `Your free vial is waiting` : `You're on the ${brand.name} list`,
      layout(
        `<p>Hi,</p>
        <p>Thanks for joining the ${escapeHtml(brand.name)} mailing list. We will email you about offers, restocks and new pack sizes, and nothing else.</p>
        ${offer}
        <p style="margin:28px 0 0">${ctaButton(offer ? welcomeLink(sub.id) : `${siteUrl()}/#buy`, "Choose your pack")}</p>
        ${marketingFooter(email)}`,
        { preheader: offer ? "An extra vial on your first order, added automatically." : "Thanks for signing up." }
      ),
      { headers: marketingHeaders(email) }
    );
  } catch (err) {
    console.error("[email] welcome email failed", err);
  }
}

/**
 * Claim the EmailLog slot for (orderId, type), then send. Returns true if
 * this call sent the email, false if it was already sent or sending failed.
 */
async function logAndSend(
  order: Order,
  type: EmailType,
  subject: string,
  html: string,
  opts?: { bcc?: string; headers?: Record<string, string> }
): Promise<boolean> {
  try {
    await prisma.emailLog.create({
      data: { orderId: order.id, type, recipient: order.customerEmail },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false; // already sent
    console.error(`[email] log failed for order ${order.id} type ${type}`, err);
    return false;
  }
  try {
    await send(order.customerEmail, subject, html, opts);
    return true;
  } catch (err) {
    console.error(`[email] send failed for order ${order.id} type ${type}`, err);
    return false;
  }
}

/**
 * The line-items table plus totals. `deliveryMinor` is what Stripe actually
 * charged for shipping (in pence) — order.totalAmount is goods-only, so
 * without this the total shown here can understate what the customer paid.
 * Pass 0 when delivery wasn't charged or isn't known (e.g. crypto orders).
 */
function receiptTable(
  items: OrderItem[],
  currency: Currency,
  deliveryMinor: number,
  goodsTotal: string
): string {
  const rows = items
    .map((i) => {
      const amount = i.lineTotal ? parseFloat(i.lineTotal) : parseFloat(i.unitPrice) * i.qty;
      // A plan's line carries the whole plan's price: name the plan, not "× 5".
      const detail =
        i.planLine === "plan" && i.bundleName ? `&middot; ${escapeHtml(i.bundleName)}` : `&times; ${i.qty}`;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LITERAL.line};color:${LITERAL.ink}">${escapeHtml(i.name)} <span style="color:${LITERAL.inkSoft}">${detail}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid ${LITERAL.line};text-align:right;color:${LITERAL.ink};white-space:nowrap">${i.welcome || i.planBonus ? "Free" : formatPrice(amount, currency)}</td>
      </tr>`;
    })
    .join("");

  const deliveryMajor = deliveryMinor / 100;
  const grandTotal = parseFloat(goodsTotal) + deliveryMajor;
  const deliveryRow =
    deliveryMinor > 0
      ? `<tr>
          <td style="padding:10px 0;color:${LITERAL.inkSoft}">Delivery</td>
          <td style="padding:10px 0;text-align:right;color:${LITERAL.inkSoft}">${formatPrice(deliveryMajor, currency)}</td>
        </tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0">
    ${rows}
    ${deliveryRow}
    <tr>
      <td style="padding:14px 0 0;border-top:2px solid ${LITERAL.ink};font-weight:700;color:${LITERAL.ink}">Total</td>
      <td style="padding:14px 0 0;border-top:2px solid ${LITERAL.ink};text-align:right;font-weight:700;color:${LITERAL.ink}">${formatPrice(grandTotal, currency)}</td>
    </tr>
  </table>`;
}

/** Comma-joined, HTML-escaped shipping address — Stripe collects this from
 * the customer at checkout, so it's untrusted input by the time it lands
 * here. Shared by the confirmation email and the owner alert. */
function shippingAddressLine(order: Order): string {
  try {
    const a = JSON.parse(order.shippingAddress) as {
      line1: string;
      line2?: string | null;
      city: string;
      country: string;
      postalCode?: string | null;
    };
    return [a.line1, a.line2, a.city, a.postalCode, a.country]
      .filter(Boolean)
      .map((part) => escapeHtml(String(part)))
      .join(", ");
  } catch {
    return "(address unreadable)";
  }
}

// ── Trustpilot review invitations ────────────────────────────────────────
// Trustpilot's Automatic Feedback Service: BCC the account's unique invite
// address on the order confirmation, and Trustpilot emails the customer a
// review invitation after the delay set in Trustpilot Business (Invitations →
// Automatic Feedback Service). Set that delay long enough for the parcel to
// arrive — this email goes out the moment payment lands.

/** The AFS address, or null when invitations are switched off. Runtime env. */
export function trustpilotBcc(): string | null {
  const v = process.env.TRUSTPILOT_BCC_EMAIL?.trim();
  return v && v.endsWith("@invite.trustpilot.com") ? v : null;
}

/**
 * Structured data Trustpilot reads from the BCC'd copy, so the invitation
 * goes to the right name and address with the order as its reference rather
 * than whatever Trustpilot guesses from the headers. Mail clients strip
 * <script> tags, so the customer never sees it. `<` is escaped so a customer
 * name cannot close the tag.
 */
function trustpilotSnippet(order: Order): string {
  const json = JSON.stringify({
    recipientName: order.customerName,
    recipientEmail: order.customerEmail,
    referenceId: order.id,
  }).replace(/</g, "\\u003c");
  return `<script type="application/json+trustpilot">${json}</script>`;
}

/**
 * Invite only customers who have not unsubscribed from our emails. Someone
 * who asked us to stop should not hear from a third party on our behalf.
 */
async function trustpilotBccFor(order: Order): Promise<string | null> {
  const bcc = trustpilotBcc();
  if (!bcc || !order.customerEmail) return null;
  try {
    const optedOut = await prisma.emailOptOut.findUnique({
      where: { email: order.customerEmail.toLowerCase() },
    });
    return optedOut ? null : bcc;
  } catch (err) {
    // Unknown opt-out state: fail towards not inviting.
    console.error(`[email] trustpilot opt-out check failed for order ${order.id}`, err);
    return null;
  }
}

/**
 * Whether the customer has unsubscribed (EmailOptOut, lowercased as every
 * sender stores it). The plan upgrade offer is marketing, so it is left out
 * of the receipt for them. Unknown state fails towards not offering.
 */
async function optedOutOfEmails(order: Order): Promise<boolean> {
  if (!order.customerEmail) return true;
  try {
    return (await prisma.emailOptOut.findUnique({ where: { email: order.customerEmail.toLowerCase() } })) !== null;
  } catch (err) {
    console.error(`[email] opt-out check failed for order ${order.id}`, err);
    return true;
  }
}

export async function sendOrderConfirmationEmail(
  order: Order,
  opts?: { deliveryMinor?: number }
): Promise<void> {
  const kind = orderKind(order.kind);
  if (kind === "plan_box") return; // boxes are not sales; they get the shipped email only
  const plan = order.planId ? await prisma.plan.findUnique({ where: { id: order.planId } }) : null;
  if (kind === "plan_upgrade") {
    // A payment that could not start a plan is cancelled and refunded by hand: no "started" email.
    if (plan && plan.status !== "cancelled") await sendPlanStartedEmail(order, plan);
    return;
  }
  const items = JSON.parse(order.items) as OrderItem[];
  const currency = order.currency as Currency;
  const orderUrl = `${siteUrl()}/order-confirmation/${order.id}`;
  const planBlock = plan
    ? `<p style="margin:24px 0 0;font-weight:600;color:${LITERAL.ink}">Your monthly plan</p>${planScheduleHtml(planTermsOf(plan))}`
    : "";
  const verdict = plan ? null : upgradeEligibility(order, new Date());
  const upgradeBlock =
    verdict?.eligible && !(await optedOutOfEmails(order))
      ? upgradeOfferHtml({ packId: verdict.packId, orderUrl, deadline: verdict.deadline })
      : "";
  const placedOn = order.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deliveryMinor = opts?.deliveryMinor ?? 0;
  const grandTotal = parseFloat(order.totalAmount.toString()) + deliveryMinor / 100;
  const bcc = await trustpilotBccFor(order);
  // More than one with the reminder bonus (lib/mailing-list.ts welcomeVialCount).
  const welcomeVials = items.reduce((n, i) => (i.welcome ? n + i.qty : n), 0);

  await logAndSend(
    order,
    "confirmation",
    plan ? `Your ${brand.name} monthly plan is confirmed` : `Your ${brand.name} order is confirmed`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>${plan ? "Thank you for your order." : "Thanks for your order!"} Your payment has been received and we're getting it ready.</p>
      ${welcomeVials > 0 ? `<p style="margin:0 0 12px">Your mailing-list welcome gift, ${welcomeVials === 1 ? "an extra 10ml vial" : `${welcomeVials} extra 10ml vials`}, is included in this order.</p>` : ""}
      <p style="margin:0 0 4px;font-size:12px;color:${LITERAL.inkSoft}">Order ${order.id} &middot; placed ${placedOn}</p>
      ${receiptTable(items, currency, deliveryMinor, order.totalAmount.toString())}
      ${planBlock}
      ${
        order.shippingAddress
          ? `<p style="margin:20px 0 0;font-size:13px;color:${LITERAL.inkSoft}"><strong style="color:${LITERAL.ink}">Shipping to</strong><br>${shippingAddressLine(order)}</p>`
          : ""
      }
      ${upgradeBlock}
      <p style="margin:28px 0 0">${ctaButton(orderUrl, "View your order")}</p>
      ${bcc ? trustpilotSnippet(order) : ""}`,
      { preheader: `Order ${order.id} confirmed — total ${formatPrice(grandTotal, currency)}` }
    ),
    bcc ? { bcc } : undefined
  );
}

/** The "plan has started" email for a plan-upgrade payment, sent instead of a receipt. */
async function sendPlanStartedEmail(order: Order, plan: Plan): Promise<void> {
  const original = await prisma.order.findFirst({ where: { planId: plan.id, planBox: 1 } });
  const copy = planStartedCopy({
    customerName: order.customerName,
    originalRef: (original?.id ?? "").slice(0, 8).toUpperCase(),
    plan: planTermsOf(plan),
    paidMinor: order.amountPaidMinor ?? Math.round(Number(order.totalAmount) * 100),
  });
  await logAndSend(
    order,
    "confirmation",
    copy.subject,
    layout(
      `${copy.body}<p style="margin:28px 0 0">${ctaButton(`${siteUrl()}/order-confirmation/${order.id}`, "View your plan")}</p>`,
      { preheader: copy.preheader }
    )
  );
}

/** The parcel's tracking, when the order has a label: its first number and who carries it. */
export interface ShippedTracking {
  number: string;
  carrier: string;
}

/**
 * Sent once, when the carrier first scans the parcel (lib/shipping/
 * tracking-sync.ts) or when someone marks the order shipped by hand. The
 * order page it links to shows the latest tracking.
 */
export async function sendOrderShippedEmail(order: Order, tracking?: ShippedTracking | null): Promise<void> {
  const orderUrl = `${siteUrl()}/order-confirmation/${order.id}`;
  const trackingLine = tracking?.number
    ? `<p style="margin:0 0 20px">Your tracking number${tracking.carrier ? ` with ${escapeHtml(tracking.carrier)}` : ""} is
      <strong style="font-family:monospace;font-size:15px">${escapeHtml(tracking.number)}</strong>. Your order page shows where it has got to.</p>`
    : "";
  const plan = order.planId && order.planBox ? await prisma.plan.findUnique({ where: { id: order.planId } }) : null;
  const box =
    plan && order.planBox
      ? boxShippedCopy({
          boxNumber: order.planBox,
          months: plan.months,
          // Only a running plan has a next box; a cancelled one says no more are coming.
          nextBoxDay:
            plan.status === "active" && plan.anchorDay && order.planBox < plan.months
              ? boxDueDay(plan.anchorDay, order.planBox + 1)
              : null,
          cancelled: plan.status === "cancelled",
        })
      : null;
  await logAndSend(
    order,
    "shipped",
    box ? box.subject : `Your ${brand.name} order is on its way`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>${box ? escapeHtml(box.lead) : "Good news — your order has been shipped and is on its way to you."}</p>
      ${trackingLine}
      ${box ? `<p style="margin:0 0 20px">${escapeHtml(box.next)}</p>` : ""}
      <p style="margin:0 0 20px;font-size:12px;color:${LITERAL.inkSoft}">Order reference: ${order.id}</p>
      ${ctaButton(orderUrl, tracking?.number ? "Track your order" : "View your order")}`,
      { preheader: box ? box.preheader : tracking?.number ? `Tracking number ${tracking.number}` : `Order ${order.id} has shipped` }
    )
  );
}

export async function sendOrderDeliveredEmail(order: Order): Promise<void> {
  const orderUrl = `${siteUrl()}/order-confirmation/${order.id}`;
  await logAndSend(
    order,
    "delivered",
    `Your ${brand.name} order has been delivered`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>Your order has been delivered. We hope you enjoy it!</p>
      <p style="margin:0 0 20px;font-size:12px;color:${LITERAL.inkSoft}">Order reference: ${order.id}</p>
      ${ctaButton(orderUrl, "View your order")}`,
      { preheader: `Order ${order.id} has been delivered` }
    )
  );
}

/**
 * The renewal email, 14 days before a plan's last box (lib/plans/boxes.ts).
 * Plans never renew by themselves: this only offers a new one at today's
 * price, preselected on the picker. Logged once per plan against its
 * purchase order. Carries the marketing footer and headers.
 */
export async function sendPlanRenewalEmail(plan: Plan, order: Order): Promise<boolean> {
  if (!isPlanPackId(plan.packId) || !isPlanMonths(plan.months)) return false;
  const renewUrl = `${siteUrl()}/?plan=${planKey(plan.packId, plan.months)}#buy`;
  const copy = renewalCopy({ customerName: order.customerName, plan: planTermsOf(plan), renewUrl });
  return logAndSend(
    order,
    "plan_renewal",
    copy.subject,
    layout(`${copy.body}${marketingFooter(order.customerEmail)}`, { preheader: copy.preheader }),
    { headers: marketingHeaders(order.customerEmail) }
  );
}

/** items here are only the nudgeable ones (supplyDays > 0). */
export async function sendRepurchaseNudgeEmail(
  order: Order,
  items: OrderItem[]
): Promise<boolean> {
  const list = items
    .map(
      (i) =>
        `<li style="margin:6px 0"><a href="${siteUrl()}/products/${i.slug}" style="color:${LITERAL.brand}">${i.name}</a></li>`
    )
    .join("");
  const pack = nudgePlanPack(order);
  const planBlock = pack ? nudgePlanOfferHtml(pack, siteUrl()) : "";
  return logAndSend(
    order,
    "nudge",
    `Running low? Time to restock your ${brand.name} favourites`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>By our count, the products from your last order may be running low. Reorder before you run out:</p>
      <ul style="padding-left:18px">${list}</ul>
      ${planBlock}
      <p><a href="${siteUrl()}/products" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Shop again</a></p>
      <p style="font-size:11px;color:#6b7a72;margin-top:24px">Don't want reminders like this?
        <a href="${unsubscribeUrl(order.customerEmail)}" style="color:#6b7a72">Unsubscribe</a></p>`)
  );
}

/**
 * One request for a review, a few days after delivery. Sent by the daily
 * cron (app/api/cron/nudges/route.ts), never from a webhook, so it cannot
 * arrive before the parcel does. The EmailLog slot makes it once per order.
 *
 * Where it sends them is config: brand.reviews.url when a public review page
 * exists, otherwise a reply to the support address. Reviews received are
 * added to config/reviews.json by hand — nothing here writes one, and the
 * email must never offer anything in return for a review (the DMCC Act 2024
 * treats an incentivised review that does not say so as a fake one).
 */
export async function sendReviewRequestEmail(order: Order): Promise<boolean> {
  const reviewUrl = brand.reviews.url;
  const support = brand.contact.email;
  const ask = reviewUrl
    ? `<p style="margin:24px 0 0">${ctaButton(reviewUrl, "Leave a review")}</p>`
    : support
      ? `<p>Reply to this email, or write to <a href="mailto:${support}" style="color:${LITERAL.brand}">${support}</a>. A sentence or two is plenty.</p>`
      : `<p>Reply to this email. A sentence or two is plenty.</p>`;

  return logAndSend(
    order,
    "review",
    `How was your ${brand.name} order?`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>Your order should have arrived by now. If you have a minute, we would value a few words on how it went: the vial, the packaging, the delivery.</p>
      <p>Honest reviews, good or bad, are the only kind we publish, and we do not offer anything in return for one.</p>
      ${ask}
      <p style="margin:24px 0 0;font-size:12px;color:${LITERAL.inkSoft}">Order reference: ${order.id}</p>
      <p style="font-size:11px;color:#6b7a72;margin-top:24px">Don't want emails like this?
        <a href="${unsubscribeUrl(order.customerEmail)}" style="color:#6b7a72">Unsubscribe</a></p>`,
      { preheader: `A quick word on order ${order.id}?` }
    )
  );
}

// ── Admin alert: notify the shop owner when a paid order lands ───────────
// Sent to ORDER_NOTIFY_EMAIL (if set) from the payment webhook. Not recorded in
// EmailLog — the webhook's pending→paid guard already makes it fire exactly once.

export function buildNewOrderAlert(
  order: Order,
  opts?: { deliveryMinor?: number }
): { subject: string; html: string } {
  const items = JSON.parse(order.items) as OrderItem[];
  const currency = order.currency as Currency;
  const deliveryMinor = opts?.deliveryMinor ?? 0;
  const grandTotal = parseFloat(order.totalAmount.toString()) + deliveryMinor / 100;

  const total = formatPrice(grandTotal, currency);
  const subject = `New paid order — ${total} from ${order.customerName}`;
  const html = layout(`<p style="font-weight:bold;margin-top:0">You have a new paid order.</p>
      ${orderKind(order.kind) === "plan_upgrade" ? `<p style="margin:0 0 12px">${escapeHtml(order.notes ?? "Plan upgrade")}</p>` : ""}
      ${receiptTable(items, currency, deliveryMinor, order.totalAmount.toString())}
      <p style="margin:20px 0 0"><strong>Paid:</strong> ${formatSaleDateTime(saleTime(order))} (UK time)</p>
      <p style="margin:12px 0 0"><strong>Customer:</strong> ${escapeHtml(order.customerName)}<br>
         <strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br>
         <strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>
      <p style="margin:12px 0 0"><strong>Ship to:</strong> ${shippingAddressLine(order)}</p>
      <p style="margin:20px 0 0;font-size:12px;color:${LITERAL.inkSoft}">Order ${order.id} &middot; paid via ${escapeHtml(String(order.paymentMethod).toUpperCase())}</p>`);
  return { subject, html };
}

/** Email the shop owner about a paid order. No-op if ORDER_NOTIFY_EMAIL is unset. */
export async function sendNewOrderAlert(
  order: Order,
  opts?: { deliveryMinor?: number }
): Promise<void> {
  const to = process.env.ORDER_NOTIFY_EMAIL;
  if (!to) return;
  try {
    const { subject, html } = buildNewOrderAlert(order, opts);
    await send(to, subject, html);
  } catch (err) {
    console.error(`[email] order alert failed for ${order.id}`, err);
  }
}
