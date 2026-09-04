import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendRepurchaseNudgeEmail } from "@/lib/customer-email";

export const dynamic = "force-dynamic";

// Daily repurchase-nudge job. Hit by server cron:
//   15 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/nudges
// EmailLog's unique(orderId, type) makes re-runs harmless.

const LEAD_DAYS = 4; // nudge this many days before the supply runs out
const NUDGEABLE_STATUSES = ["paid", "packed", "shipped", "delivered"];

interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  unitPriceUsd: string;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
      const nudgeable = items.filter((i) => (supplyDays.get(i.productId) ?? 0) > 0);
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

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNudges();
  return NextResponse.json(result);
}

// GET supported so the crontab line can use plain curl
export const GET = POST;
