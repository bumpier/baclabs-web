"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandPathname } from "@/lib/brand/use-brand-pathname";
import { count } from "@/brands/wholesale/copy/home";
import { ORDER } from "@/brands/wholesale/copy/order";
import { basketVials } from "@/brands/wholesale/components/order-math";
import { SHOW_ORDER_EVENT } from "@/brands/wholesale/components/events";

/**
 * The header's order button: a crate icon and the order's vial count. On
 * the product page it shows the order summary where it is (beside the
 * price table, or the bottom sheet on a phone); on any other page it is a
 * link to it.
 */
export function OrderButton() {
  const cart = useCart();
  const pathname = useBrandPathname();
  const n = cart.hydrated ? basketVials(cart.storefront, cart.lines) : 0;
  // The count bumps when it changes, never on load.
  const [live, setLive] = useState(false);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!cart.hydrated) return;
    if (seen.current !== null && seen.current !== n) setLive(true);
    seen.current = n;
  }, [cart.hydrated, n]);
  const inner = (
    <>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" className="bk-order-icon">
        <path d="M3.5 8.5 12 4l8.5 4.5v8L12 21l-8.5-4.5z M3.5 8.5 12 13l8.5-4.5 M12 13v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span className="bk-order-word">{ORDER.button}</span>
      <span key={n} className="bk-order-count" data-empty={n === 0 ? "" : undefined}>
        {count(n)}
      </span>
    </>
  );
  if (pathname === "/") {
    return (
      <button type="button" className="bk-order-btn" data-live={live ? "" : undefined} aria-label={ORDER.buttonLabel(n)} onClick={() => window.dispatchEvent(new Event(SHOW_ORDER_EVENT))}>
        {inner}
      </button>
    );
  }
  return (
    <Link href="/#order" className="bk-order-btn" data-live={live ? "" : undefined} aria-label={ORDER.buttonLabel(n)}>
      {inner}
    </Link>
  );
}
