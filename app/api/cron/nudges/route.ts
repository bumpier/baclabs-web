import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import {
  sendRepurchaseNudgeEmail,
  sendReviewRequestEmail,
  trustpilotBcc,
} from "@/lib/customer-email";

export const dynamic = "force-dynamic";

// Daily job: repurchase nudges, then review requests. Hit by server cron:
//   15 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/nudges
// EmailLog's unique(orderId, type) makes re-runs harmless.

const LEAD_DAYS = 4; // nudge this many days before the supply runs out
const NUDGEABLE_STATUSES = ["paid", "packed", "shipped", "delivered"];

/** Days after an order is delivered before the review request goes. */
const REVIEW_DELAY_DAYS = 5;
/**
 * An order still "shipped" this many days after it shipped is treated as
 * delivered for the review request — tracking does not see every delivery.
 * Long enough that a UK parcel has arrived either way.
 */
const REVIEW_SHIPPED_FALLBACK_DAYS = 12;
/**
 * Never ask about a parcel that arrived longer ago than this. Orders closed
 * by the catch-up page have no dates at all, so are never asked.
 */
const REVIEW_MAX_AGE_DAYS = 30;

interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  unitPriceUsd: string;
}

async function runNudges() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: NUDGEABLE_STATUSES },
      emailLogs: { none: { type: "nudge" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // supplyDays lookup for every product referenced by candidate orders
  const productIds = new Set<string>();
  const parsed = orders.map((o) => {
    const items = JSON.parse(o.items) as OrderItem[];
    items.forEach((i) => productIds.add(i.productId));
    return { order: o, items };
  });
  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    select: { id: true, supplyDays: true },
  });
  const supplyDays = new Map(products.map((p) => [p.id, p.supplyDays]));

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const { order, items } of parsed) {
    try {
      // The mailing-list welcome vial rides along with a real purchase; as a
      // line of its own it would bring the reminder forward to one vial's
      // supply.
      const nudgeable = items.filter(
        (i) => !(i as { welcome?: boolean }).welcome && (supplyDays.get(i.productId) ?? 0) > 0
      );
      if (nudgeable.length === 0) {
        skipped++;
        continue;
      }

      const daysUntilEmpty = Math.min(
        ...nudgeable.map((i) => i.qty * (supplyDays.get(i.productId) ?? 0))
      );
      const dueAt =
        order.createdAt.getTime() + (daysUntilEmpty - LEAD_DAYS) * 24 * 60 * 60 * 1000;
      if (dueAt > now) {
        skipped++;
        continue;
      }

      // Already repurchased? (any non-cancelled order placed after this one)
      const newer = await prisma.order.count({
        where: {
          customerEmail: order.customerEmail,
          createdAt: { gt: order.createdAt },
          status: { not: "cancelled" },
        },
      });
      if (newer > 0) {
        skipped++;
        continue;
      }

      const optedOut = await prisma.emailOptOut.findUnique({
        where: { email: order.customerEmail.toLowerCase() },
      });
      if (optedOut) {
        skipped++;
        continue;
      }

      const didSend = await sendRepurchaseNudgeEmail(order, nudgeable);
      if (didSend) sent++;
      else skipped++;
    } catch (err) {
      console.error(`[nudge] order ${order.id} failed`, err);
      skipped++;
    }
  }

  return { scanned: orders.length, sent, skipped };
}

/**
 * Review requests. One per order, only once the parcel has had time to
 * arrive, never to an opted-out address. The delay runs from deliveredAt
 * (or shippedAt), set by tracking or by marking the order by hand — not
 * updatedAt, which moves on every write.
 */
async function runReviewRequests() {
  // With Trustpilot invitations on, Trustpilot asks every customer itself
  // (BCC on the confirmation email). A second request from us would be a
  // duplicate ask, so this job stands down.
  if (trustpilotBcc()) return { scanned: 0, sent: 0, skipped: 0, handledBy: "trustpilot" };

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const tooOld = new Date(now - REVIEW_MAX_AGE_DAYS * day);
  const orders = await prisma.order.findMany({
    where: {
      emailLogs: { none: { type: "review" } },
      OR: [
        { status: "delivered", deliveredAt: { lte: new Date(now - REVIEW_DELAY_DAYS * day), gte: tooOld } },
        { status: "shipped", shippedAt: { lte: new Date(now - REVIEW_SHIPPED_FALLBACK_DAYS * day), gte: tooOld } },
      ],
    },
    orderBy: [{ deliveredAt: "asc" }, { shippedAt: "asc" }],
  });

  let sent = 0;
  let skipped = 0;
  for (const order of orders) {
    try {
      if (!order.customerEmail) {
        skipped++;
        continue;
      }
      const optedOut = await prisma.emailOptOut.findUnique({
        where: { email: order.customerEmail.toLowerCase() },
      });
      if (optedOut) {
        skipped++;
        continue;
      }
      const didSend = await sendReviewRequestEmail(order);
      if (didSend) sent++;
      else skipped++;
    } catch (err) {
      console.error(`[review] order ${order.id} failed`, err);
      skipped++;
    }
  }
  return { scanned: orders.length, sent, skipped };
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const nudges = await runNudges();
  const reviews = await runReviewRequests();
  return NextResponse.json({ ...nudges, reviews });
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
