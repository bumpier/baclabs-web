"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a brand's confirmation page up to date while its order is still
 * pending: the customer usually arrives back from paying before the payment
 * is confirmed to us. It asks /api/order-status (which answers only for the
 * Host's own brand) every few seconds and re-renders the page from the
 * server once the status moves, without a full reload. BacLab's page does
 * the same with a meta refresh, and its pay page with PayStatus.
 *
 * Polls only while `status` is "pending", and gives up after `maxPolls`, by
 * when the page's own words ("reload for the latest") take over. Renders
 * nothing: the page announces the change in its own role="status" region.
 */
export function OrderStatusWatcher({
  orderId,
  status,
  intervalMs = 5000,
  maxPolls = 60,
}: {
  orderId: string;
  status: string;
  intervalMs?: number;
  maxPolls?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "pending") return;
    let active = true;
    let polls = 0;
    const timer = window.setInterval(async () => {
      if (++polls > maxPolls) {
        window.clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`/api/order-status/${encodeURIComponent(orderId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string };
        if (active && data.status && data.status !== status) {
          window.clearInterval(timer);
          router.refresh();
        }
      } catch {
        // A blip in the connection: try again on the next tick.
      }
    }, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [orderId, status, intervalMs, maxPolls, router]);

  return null;
}
