import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parsePendingNote } from "@/lib/crypto-gateway";
import { PayStatus } from "./PayStatus";

export const dynamic = "force-dynamic";

const COIN_LABELS: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "USDT (Tether)",
  XMR: "Monero",
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  // Already settled (or no longer payable) → send to the confirmation page.
  if (order.status !== "pending") redirect(`/order-confirmation/${id}`);

  const payment = parsePendingNote(order.notes);
  // No deposit details recorded (shouldn't happen for a pending crypto order).
  if (!payment) redirect(`/order-confirmation/${id}`);

  const coin = payment.currency.toUpperCase();
  const coinLabel = COIN_LABELS[coin] ?? coin;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-8 py-8 text-center text-white">
          <h1 className="font-display text-2xl font-medium tracking-tight">
            Complete your payment
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Send the exact amount of {coinLabel} to the address below. This page
            updates automatically once your payment is confirmed.
          </p>
        </div>

        <div className="p-8">
          <PayStatus
            orderId={order.id}
            currency={coin}
            amount={payment.amount}
            wallet={payment.wallet}
            qr={payment.qr}
            expiresAt={payment.expiresAt}
          />

          <p className="mt-8 text-center text-xs text-ink-soft">
            Order <span className="font-mono">{order.id}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
