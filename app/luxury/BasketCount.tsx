"use client";

import { useCart } from "@/components/commerce/cart";
import { NAV } from "@/brands/luxury/copy/site";

/**
 * The number of boxes in the order, beside the header's "Order" link. Nothing
 * until the stored basket has been read (so the server's render and the
 * first browser render agree), and nothing while it is empty.
 */
export function BasketCount() {
  const { count, hydrated } = useCart();
  if (!hydrated || count === 0) return null;
  return (
    <span className="rx-count">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">, {NAV.inOrder(count)}</span>
    </span>
  );
}
