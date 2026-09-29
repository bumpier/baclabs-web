import { createHash } from "node:crypto";
import type { Campaign } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ctaButton, escapeHtml, layout, send, sendBatch } from "@/lib/email";
import { marketingFooter, marketingHeaders } from "@/lib/customer-email";
import { getStripe } from "@/lib/payments/stripe";
import { LITERAL } from "@/lib/theme";
import { normEmail } from "@/lib/mailing-list";

// Marketing email campaigns, written and sent from /admin/campaigns.
//
// Sending is two steps so it can never double-send and always resumes:
//  1. startCampaign() resolves the audience into CampaignRecipient rows, one
//     per address, in the same transaction that moves the campaign from
//     draft to sending. The unique (campaign, email) pair is the guarantee.
//  2. processCampaign() sends the queued rows 100 at a time through Resend's
//     batch API and marks each one. If the process dies part-way, the cron
//     route (app/api/cron/campaigns) picks up whatever is still queued.
//
// Everyone on EmailOptOut is left out at step 1, whichever audience they
// fall in, and every email carries a one-click unsubscribe.

// ── Audience ───────────────────────────────────────────────────────

export interface AudienceSpec {
  /** Everyone subscribed to the mailing list. */
  subscribers: boolean;
  /** Subscribers who have never placed an order. Ignored when `subscribers` is on. */
  subscribersNotOrdered: boolean;
  /** Everyone who has placed an order (PECR soft opt-in; the opt-out list applies). */
  customers: boolean;
  /** Customers whose last order is at least `lapsedDays` old. Ignored when `customers` is on. */
  lapsedCustomers: boolean;
  lapsedDays: number;
}

export const EMPTY_AUDIENCE: AudienceSpec = {
  subscribers: false,
  subscribersNotOrdered: false,
  customers: false,
  lapsedCustomers: false,
  lapsedDays: 90,
};

export function parseAudience(json: string): AudienceSpec {
  try {
    const raw = JSON.parse(json) as Partial<AudienceSpec>;
    const days = Number(raw.lapsedDays);
    return {
      subscribers: raw.subscribers === true,
      subscribersNotOrdered: raw.subscribersNotOrdered === true,
      customers: raw.customers === true,
      lapsedCustomers: raw.lapsedCustomers === true,
      lapsedDays: Number.isFinite(days) && days > 0 ? Math.floor(days) : 90,
    };
  } catch {
    return { ...EMPTY_AUDIENCE };
  }
}

export function describeAudience(a: AudienceSpec): string {
  const parts: string[] = [];
  if (a.subscribers) parts.push("all subscribers");
  else if (a.subscribersNotOrdered) parts.push("subscribers who haven't ordered");
  if (a.customers) parts.push("all customers");
  else if (a.lapsedCustomers) parts.push(`customers with no order for ${a.lapsedDays} days`);
  return parts.length ? parts.join(" + ") : "nobody";
}

export interface Recipient {
  email: string;
  firstName: string;
}

export interface CustomerRow {
  email: string;
  name: string;
  lastOrderAt: Date;
}

/**
 * The audience as a list of addresses, de-duplicated, with everyone opted out
 * removed. Pure: the database reads are done by resolveAudience, so the rules
 * are testable on their own.
 */
export function mergeAudience(
  spec: AudienceSpec,
  subscribers: { email: string }[],
  customers: CustomerRow[],
  optedOut: Set<string>,
  now: Date = new Date()
): Recipient[] {
  const out = new Map<string, Recipient>();
  const byEmail = new Map(customers.map((c) => [normEmail(c.email), c]));
  const firstName = (email: string) => (byEmail.get(email)?.name.trim().split(/\s+/)[0] ?? "").slice(0, 60);
  const add = (raw: string) => {
    const email = normEmail(raw);
    if (!email || optedOut.has(email) || out.has(email)) return;
    out.set(email, { email, firstName: firstName(email) });
  };

  if (spec.subscribers) subscribers.forEach((s) => add(s.email));
  else if (spec.subscribersNotOrdered) {
    subscribers.filter((s) => !byEmail.has(normEmail(s.email))).forEach((s) => add(s.email));
  }

  if (spec.customers) customers.forEach((c) => add(c.email));
  else if (spec.lapsedCustomers) {
    const cutoff = now.getTime() - spec.lapsedDays * 86_400_000;
    customers.filter((c) => c.lastOrderAt.getTime() <= cutoff).forEach((c) => add(c.email));
  }
  return [...out.values()];
}

/** Every address that has placed an order, with its latest name and date. */
async function customerRows(): Promise<CustomerRow[]> {
  const orders = await prisma.order.findMany({
    where: { status: { notIn: ["pending", "cancelled"] }, customerEmail: { not: "" } },
    select: { customerEmail: true, customerName: true, paidAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const rows = new Map<string, CustomerRow>();
  for (const o of orders) {
    // Ascending, so the last write per address is its latest order.
    rows.set(normEmail(o.customerEmail), {
      email: normEmail(o.customerEmail),
      name: o.customerName,
      lastOrderAt: o.paidAt ?? o.createdAt,
    });
  }
  return [...rows.values()];
}

export async function resolveAudience(spec: AudienceSpec): Promise<Recipient[]> {
  const [subscribers, customers, optOuts] = await Promise.all([
    prisma.subscriber.findMany({ where: { status: "subscribed" }, select: { email: true } }),
    customerRows(),
    prisma.emailOptOut.findMany({ select: { email: true } }),
  ]);
  return mergeAudience(spec, subscribers, customers, new Set(optOuts.map((o) => normEmail(o.email))));
}

// ── Rendering ──────────────────────────────────────────────────────

/**
 * A small, deliberately limited Markdown for email: headings (#, ##),
 * paragraphs, bullet and numbered lists, **bold**, *italic*, links, and a
 * button written [button: Label](https://…). Everything is HTML-escaped
 * first, so nothing typed in the composer can inject markup, and only
 * http(s) and mailto links survive. Inline styles throughout, because mail
 * clients drop <style>.
 */
export function markdownToEmailHtml(md: string): string {
  const safeUrl = (url: string) => (/^(https?:|mailto:)/i.test(url) ? url : "#");
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
        return `<a href="${safeUrl(url)}" style="color:${LITERAL.brand}">${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      const button = b.match(/^\[button:\s*([^\]]+)\]\(([^)\s]+)\)$/i);
      if (button) return `<p style="margin:24px 0">${ctaButton(safeUrl(button[2]), button[1].trim())}</p>`;
      const heading = b.match(/^(#{1,2})\s+(.+)$/);
      if (heading) {
        const size = heading[1].length === 1 ? 22 : 18;
        return `<h2 style="margin:24px 0 8px;font-size:${size}px;line-height:1.3;color:${LITERAL.ink}">${inline(heading[2])}</h2>`;
      }
      const lines = b.split("\n");
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul style="padding-left:20px;margin:0 0 16px">${lines
          .map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return `<ol style="padding-left:20px;margin:0 0 16px">${lines
          .map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`)
          .join("")}</ol>`;
      }
      return `<p style="margin:0 0 16px">${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

export interface MergeValues {
  firstName: string;
  code: string;
  offer: string;
  expires: string;
}

/**
 * {{first_name}}, {{code}}, {{offer}} and {{expires}}, substituted into
 * already-rendered HTML, so each value is escaped here. A missing first name
 * reads "there" ("Hi there").
 */
export function applyMergeFields(html: string, v: MergeValues): string {
  const values: Record<string, string> = {
    first_name: v.firstName || "there",
    code: v.code,
    offer: v.offer,
    expires: v.expires,
  };
  return html.replace(/\{\{\s*(first_name|code|offer|expires)\s*\}\}/g, (_, k: string) => escapeHtml(values[k]));
}

export function expiresText(c: Pick<Campaign, "offerExpiresAt">): string {
  return c.offerExpiresAt
    ? c.offerExpiresAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : "";
}

/** A block stating the code, added under the body whenever there is one. */
function offerBlock(c: Pick<Campaign, "promoCode" | "offerSummary" | "offerExpiresAt">): string {
  if (!c.promoCode) return "";
  const expires = expiresText(c);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:2px dashed ${LITERAL.line};border-radius:12px">
    <tr><td style="padding:18px;text-align:center">
      ${c.offerSummary ? `<p style="margin:0 0 6px;font-weight:700;color:${LITERAL.ink}">${escapeHtml(c.offerSummary)}</p>` : ""}
      <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.08em;color:${LITERAL.ink}">${escapeHtml(c.promoCode)}</p>
      <p style="margin:6px 0 0;font-size:12px;color:${LITERAL.inkSoft}">Enter it on the card payment page${expires ? `. Ends ${escapeHtml(expires)}` : ""}.</p>
    </td></tr>
  </table>`;
}

/** The finished email for one recipient. */
export function renderCampaign(c: Campaign, r: Recipient): string {
  const body = applyMergeFields(markdownToEmailHtml(c.bodyMarkdown), {
    firstName: r.firstName,
    code: c.promoCode ?? "",
    offer: c.offerSummary,
    expires: expiresText(c),
  });
  return layout(`${body}${offerBlock(c)}${marketingFooter(r.email)}`, {
    preheader: c.preheader || undefined,
  });
}

export function renderSubject(c: Pick<Campaign, "subject">, r: Recipient): string {
  return c.subject.replace(/\{\{\s*first_name\s*\}\}/g, r.firstName || "there");
}

// ── Offers (Stripe promotion codes) ────────────────────────────────

export interface OfferInput {
  kind: "percent" | "amount";
  /** Percent (1–100) or pence. */
  value: number;
  code: string;
  expiresAt: Date | null;
  maxRedemptions: number | null;
}

export function offerSummary(o: Pick<OfferInput, "kind" | "value">): string {
  return o.kind === "percent" ? `${o.value}% off your order` : `£${(o.value / 100).toFixed(2)} off your order`;
}

/**
 * A real Stripe coupon and a customer-facing promotion code for it. Applies
 * once, to the goods on a card checkout (allow_promotion_codes is already on
 * the session). Throws Stripe's message on failure, e.g. a code in use.
 */
export async function createStripeOffer(o: OfferInput): Promise<{ couponId: string; promotionCodeId: string }> {
  const stripe = getStripe();
  const coupon = await stripe.coupons.create({
    duration: "once",
    name: offerSummary(o).slice(0, 40),
    ...(o.kind === "percent" ? { percent_off: o.value } : { amount_off: o.value, currency: "gbp" }),
    ...(o.expiresAt ? { redeem_by: Math.floor(o.expiresAt.getTime() / 1000) } : {}),
    metadata: { source: "baclab-campaign" },
  });
  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: o.code,
    ...(o.expiresAt ? { expires_at: Math.floor(o.expiresAt.getTime() / 1000) } : {}),
    ...(o.maxRedemptions ? { max_redemptions: o.maxRedemptions } : {}),
    metadata: { source: "baclab-campaign" },
  });
  return { couponId: coupon.id, promotionCodeId: promo.id };
}

// ── Sending ────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
/** Between batches, to stay well inside Resend's default rate limit. */
const BATCH_PAUSE_MS = 600;

/**
 * Freeze the audience and move the campaign to "sending". Returns the number
 * of recipients, or throws if it was not a draft (already started elsewhere)
 * or the audience came out empty.
 */
export async function startCampaign(campaignId: string): Promise<number> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("This campaign has already been sent");

  const recipients = await resolveAudience(parseAudience(campaign.audience));
  if (recipients.length === 0) throw new Error("Nobody is in this audience (after removing unsubscribes)");

  await prisma.$transaction(async (tx) => {
    // The conditional flip is the lock: a second click finds no draft.
    const { count } = await tx.campaign.updateMany({
      where: { id: campaignId, status: "draft" },
      data: { status: "sending", recipientCount: recipients.length, sentCount: 0, failedCount: 0 },
    });
    if (count === 0) throw new Error("This campaign has already been sent");
    for (let i = 0; i < recipients.length; i += 500) {
      await tx.campaignRecipient.createMany({
        data: recipients.slice(i, i + 500).map((r) => ({ campaignId, email: r.email, firstName: r.firstName })),
      });
    }
  });
  return recipients.length;
}

// One sender per campaign per process, so the action that starts a send and
// the cron that resumes it cannot interleave batches.
const running = new Set<string>();

async function refreshCounts(campaignId: string): Promise<void> {
  const groups = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const n = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: n("sent"),
      failedCount: n("failed"),
      ...(n("queued") === 0 ? { status: "sent", sentAt: new Date() } : {}),
    },
  });
}

/**
 * Send every queued recipient of a campaign that is "sending". Safe to call
 * repeatedly and concurrently; never throws.
 */
export async function processCampaign(campaignId: string): Promise<void> {
  if (running.has(campaignId)) return;
  running.add(campaignId);
  try {
    for (;;) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign || campaign.status !== "sending") return;

      const batch = await prisma.campaignRecipient.findMany({
        where: { campaignId, status: "queued" },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) {
        await refreshCounts(campaignId);
        return;
      }

      // Keyed on exactly these recipients, so a retry after a crash between
      // Resend accepting the batch and our write returns the first result
      // rather than emailing everyone again.
      const key = `campaign:${campaignId}:${createHash("sha256")
        .update(batch.map((r) => r.id).join(","))
        .digest("hex")
        .slice(0, 32)}`;
      const results = await sendBatch(
        batch.map((r) => ({
          to: r.email,
          subject: renderSubject(campaign, r),
          html: renderCampaign(campaign, r),
          headers: marketingHeaders(r.email),
        })),
        key
      );

      const now = new Date();
      await prisma.$transaction(
        batch.map((r, i) => {
          const res = results[i];
          return prisma.campaignRecipient.update({
            where: { id: r.id },
            data:
              res && res.ok
                ? { status: "sent", resendId: res.id, sentAt: now, error: null }
                : { status: "failed", error: (res && !res.ok ? res.error : "No result").slice(0, 500) },
          });
        })
      );
      await refreshCounts(campaignId);
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  } catch (err) {
    console.error(`[campaigns] sending campaign ${campaignId} stopped`, err);
  } finally {
    running.delete(campaignId);
  }
}

/** Put the failed recipients back in the queue. The caller then processes. */
export async function retryFailed(campaignId: string): Promise<number> {
  const { count } = await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: "failed" },
    data: { status: "queued", error: null },
  });
  if (count > 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "sending", sentAt: null } });
  }
  return count;
}

/** Resume every campaign left mid-send. Called by the cron route. */
export async function resumeSendingCampaigns(): Promise<number> {
  const sending = await prisma.campaign.findMany({ where: { status: "sending" }, select: { id: true } });
  for (const c of sending) await processCampaign(c.id);
  return sending.length;
}

/** One copy to a named address, marked as a test in the subject. */
export async function sendTestEmail(c: Campaign, to: string): Promise<void> {
  const r = { email: normEmail(to), firstName: "Test" };
  await send(r.email, `[Test] ${renderSubject(c, r)}`, renderCampaign(c, r), {
    headers: marketingHeaders(r.email),
  });
}
