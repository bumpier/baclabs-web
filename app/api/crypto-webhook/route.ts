import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyWebhookSignature,
  buildAuditNote,
  GATEWAY_PROVIDER,
  type CryptoWebhookEvent,
} from "@/lib/crypto-gateway";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";

// node:crypto (HMAC) + Prisma (DB) — Edge can't run these.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNATURE_HEADER = "x-webhook-signature";

// Server-to-server webhook from the self-hosted crypto gateway
// (CRYPTO_GATEWAY_URL). On a confirmed on-chain payment it POSTs a
// `payment.confirmed` event here; we verify the HMAC signature over the raw
// body, then mark the matching order paid. Idempotent — the gateway may retry.
export async function POST(req: Request) {
  // (1) Read the RAW body BEFORE parsing — the signature is over these bytes.
  const raw = await req.text();

  // (2) The secret must be configured. A missing secret is a server
  //     misconfiguration (500), never a silent accept.
  if (!process.env.CRYPTO_WEBHOOK_SECRET) {
    console.error(
      "[crypto-webhook] CRYPTO_WEBHOOK_SECRET is not set — refusing to process"
    );
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // (3) Signature FIRST, over the raw bytes. Missing or invalid → 401.
  //     Never process an unsigned request.
  const signature = req.headers.get(SIGNATURE_HEADER);
  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[crypto-webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // (4) Only parse AFTER the signature checks out.
  let body: CryptoWebhookEvent;
  try {
    body = JSON.parse(raw) as CryptoWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // (5) Test pings (gateway /webhook-test) carry `test: true` and a fake
    //     orderId. Acknowledge but never fulfill.
    if (body.test === true) {
      return NextResponse.json({ ok: true, test: true });
    }

    // (6) Only a genuine confirmed payment does any work. Everything else is
    //     acknowledged as a no-op so the gateway stops retrying.
    const payment = body.payment;
    if (body.event !== "payment.confirmed" || payment?.status !== "confirmed") {
      return NextResponse.json({ ok: true });
    }

    const orderId = payment.orderId;
    if (!orderId) {
      console.warn("[crypto-webhook] confirmed event missing payment.orderId");
      return NextResponse.json({ ok: true });
    }

    // (7) Defense in depth — unknown order: ack (so the gateway stops retrying)
    //     but do NOT fulfill.
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      console.warn(
        `[crypto-webhook] no order for orderId=${orderId} (paymentId=${payment.paymentId}) — acking without fulfilling`
      );
      return NextResponse.json({ ok: true });
    }

    // (8) Idempotent: only the pending → paid transition fulfils. Retries, and
    //     orders already paid/shipped/cancelled, are no-ops.
    if (order.status !== "pending") {
      return NextResponse.json({ ok: true });
    }

    // Integrity signal: if checkout recorded a gateway paymentRef and it
    // disagrees with this paymentId, log it. The signed orderId is
    // authoritative, so we still proceed.
    if (
      order.paymentRef &&
      payment.paymentId &&
      order.paymentRef !== payment.paymentId
    ) {
      console.warn(
        `[crypto-webhook] paymentRef mismatch for order ${orderId}: stored=${order.paymentRef} incoming=${payment.paymentId}`
      );
    }

    await fulfillPaidOrder(orderId, {
      paymentRef: payment.paymentId ?? order.paymentRef,
      provider: GATEWAY_PROVIDER,
      // paymentId, txHash, currency, amount — audit trail (JSON in notes)
      notes: buildAuditNote(payment),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Unexpected failure — let the gateway retry.
    console.error("[crypto-webhook] processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
