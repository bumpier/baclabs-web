"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function secondsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function PayStatus({
  orderId,
  currency,
  amount,
  wallet,
  qr,
  expiresAt,
}: {
  orderId: string;
  currency: string;
  amount: string;
  wallet: string;
  qr: string | null;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => secondsUntil(expiresAt));

  // Countdown to the payment-window expiry.
  useEffect(() => {
    if (expiresAt == null) return;
    const t = setInterval(() => setSecondsLeft(secondsUntil(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Poll our order status; when the webhook flips it off "pending", advance.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/order-status/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (active && data.status && data.status !== "pending") {
          window.location.href = `/order-confirmation/${orderId}`;
        }
      } catch {
        /* transient network error — keep polling */
      }
    };
    poll();
    const t = setInterval(poll, 6000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [orderId]);

  const copy = () => {
    navigator.clipboard
      .writeText(wallet)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const expired = secondsLeft === 0;
  const countdown =
    secondsLeft == null
      ? null
      : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div>
      {/* Amount */}
      <div className="rounded-xl border border-line bg-paper p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Send exactly</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-ink">
          {amount} <span className="text-brand-deep">{currency}</span>
        </p>
      </div>

      {/* QR */}
      {qr && (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`${currency} payment QR code`}
            width={208}
            height={208}
            className="rounded-xl border border-line bg-white p-2"
          />
        </div>
      )}

      {/* Address */}
      <div className="mt-6">
        <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">
          To this {currency} address
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
          <span className="flex-1 break-all font-mono text-xs text-ink">{wallet}</span>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-brand-tint"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm">
        {expired ? (
          <span className="font-medium text-ink-soft">This payment window has expired.</span>
        ) : (
          <>
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-line border-t-brand"
              aria-hidden
            />
            <span className="text-ink-soft">
              Waiting for payment
              {countdown ? <> · expires in <span className="font-mono">{countdown}</span></> : null}
            </span>
          </>
        )}
      </div>

      {expired && (
        <div className="mt-4 text-center">
          <Link href="/checkout" className="btn-secondary">
            Start a new payment
          </Link>
        </div>
      )}
    </div>
  );
}
