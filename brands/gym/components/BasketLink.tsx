"use client";

import Link from "next/link";
import { useCart } from "@/components/commerce/cart";
import { SITE } from "@/brands/gym/copy/site";

/**
 * The header's way to the basket, on every page: the basket lives on the
 * home page (#buy). The count shows once the stored basket has been read,
 * so it never flashes a zero, and its words are in the link's name.
 */
export function BasketLink() {
  const { count, hydrated } = useCart();
  const shown = hydrated && count > 0;
  return (
    <Link href="/#buy" className="gym-basket-link">
      <span>{SITE.basket}</span>
      {shown ? (
        <span className="gym-basket-count gym-figure" aria-hidden="true">
          {count}
        </span>
      ) : null}
      {shown ? <span className="sr-only">, {SITE.basketCount(count)}</span> : null}
    </Link>
  );
}
