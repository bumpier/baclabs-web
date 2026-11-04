import { NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/lib/commerce/payments/paypal-settle";

// Prisma and PayPal: Node only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayPal's events for the brands' orders. The raw text is read once: the
// signature check sends it back to PayPal exactly as it arrived
// (lib/commerce/payments/paypal-settle.ts).
export async function POST(req: Request) {
  const { status, body } = await handlePayPalWebhook(await req.text(), req.headers);
  return NextResponse.json(body, { status });
}
