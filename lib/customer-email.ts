import { createHmac } from "node:crypto";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { send, layout, escapeHtml, ctaButton } from "@/lib/email";
import { canonicalOrigin } from "@/lib/site-url";
import { LITERAL } from "@/lib/theme";
import { brand, formatPrice, type Currency } from "@/config/brand";

// Customer-facing order emails. Every send is recorded in EmailLog first;
// the @@unique([orderId, type]) constraint makes double-sends impossible.
// Senders never throw — a Resend outage must not break a webhook or
// admin action. Callers fire-and-forget.

export type EmailType = "confirmation" | "shipped" | "delivered" | "nudge";

interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  unitPriceUsd: string;
  /** Exact line total. Falls back to unitPrice × qty for orders placed before this field existed. */
  lineTotal?: string;
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
 * Claim the EmailLog slot for (orderId, type), then send. Returns true if
 * this call sent the email, false if it was already sent or sending failed.
 */
async function logAndSend(
  order: Order,
  type: EmailType,
  subject: string,
  html: string
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
    await send(order.customerEmail, subject, html);
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
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LITERAL.line};color:${LITERAL.ink}">${escapeHtml(i.name)} <span style="color:${LITERAL.inkSoft}">&times; ${i.qty}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid ${LITERAL.line};text-align:right;color:${LITERAL.ink};white-space:nowrap">${formatPrice(amount, currency)}</td>
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

export async function sendOrderConfirmationEmail(
  order: Order,
  opts?: { deliveryMinor?: number }
): Promise<void> {
  const items = JSON.parse(order.items) as OrderItem[];
  const currency = order.currency as Currency;
  const orderUrl = `${siteUrl()}/order-confirmation/${order.id}`;
  const placedOn = order.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deliveryMinor = opts?.deliveryMinor ?? 0;
  const grandTotal = parseFloat(order.totalAmount.toString()) + deliveryMinor / 100;

  await logAndSend(
    order,
    "confirmation",
    `Your ${brand.name} order is confirmed`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>Thanks for your order! Your payment has been received and we're getting it ready.</p>
      <p style="margin:0 0 4px;font-size:12px;color:${LITERAL.inkSoft}">Order ${order.id} &middot; placed ${placedOn}</p>
      ${receiptTable(items, currency, deliveryMinor, order.totalAmount.toString())}
      ${
        order.shippingAddress
          ? `<p style="margin:20px 0 0;font-size:13px;color:${LITERAL.inkSoft}"><strong style="color:${LITERAL.ink}">Shipping to</strong><br>${shippingAddressLine(order)}</p>`
          : ""
      }
      <p style="margin:28px 0 0">${ctaButton(orderUrl, "View your order")}</p>`,
      { preheader: `Order ${order.id} confirmed — total ${formatPrice(grandTotal, currency)}` }
    )
  );
}

export async function sendOrderShippedEmail(order: Order): Promise<void> {
  const orderUrl = `${siteUrl()}/order-confirmation/${order.id}`;
  await logAndSend(
    order,
    "shipped",
    `Your ${brand.name} order is on its way`,
    layout(
      `<p>Hi ${escapeHtml(order.customerName)},</p>
      <p>Good news — your order has been shipped and is on its way to you.</p>
      <p style="margin:0 0 20px;font-size:12px;color:${LITERAL.inkSoft}">Order reference: ${order.id}</p>
      ${ctaButton(orderUrl, "View your order")}`,
      { preheader: `Order ${order.id} has shipped` }
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
  return logAndSend(
    order,
    "nudge",
    `Running low? Time to restock your ${brand.name} favourites`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>By our count, the products from your last order may be running low. Reorder before you run out:</p>
      <ul style="padding-left:18px">${list}</ul>
      <p><a href="${siteUrl()}/products" style="background:${LITERAL.brand};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Shop again</a></p>
      <p style="font-size:11px;color:#6b7a72;margin-top:24px">Don't want reminders like this?
        <a href="${unsubscribeUrl(order.customerEmail)}" style="color:#6b7a72">Unsubscribe</a></p>`)
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
      ${receiptTable(items, currency, deliveryMinor, order.totalAmount.toString())}
      <p style="margin:20px 0 0"><strong>Customer:</strong> ${escapeHtml(order.customerName)}<br>
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
