import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { originFromHeaders } from "@/lib/site-url";
import { paidOrderSince, resumeTarget } from "@/lib/payments/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The "Complete my order" button in a checkout-recovery email
 * (lib/customer-email.ts sendCheckoutRecoveryEmail). Decides where to send
 * the customer (resumeTarget): Stripe's recovery link while it still charges
 * what the order says, or the buy box set to the same order.
 *
 * Writes nothing. Mail scanners open links before people do, so a GET here
 * must be safe to repeat; the only id it takes is the order's, and all it
 * reveals is a redirect.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("o") ?? "";
  const order = id ? await prisma.order.findUnique({ where: { id } }) : null;

  // Already bought again since (on another device, say): don't offer to
  // charge for the same thing twice.
  const newerPaidOrder =
    order?.status === "pending" && order.recoveryEmail
      ? await paidOrderSince(order.recoveryEmail, order.createdAt, false)
      : false;

  const target = resumeTarget({ order, newerPaidOrder, now: new Date() });
  return NextResponse.redirect(target.startsWith("http") ? target : new URL(target, originFromHeaders(req.headers)), 303);
}
