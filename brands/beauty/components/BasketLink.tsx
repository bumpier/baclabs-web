"use client";

import Link from "next/link";
import { useCart } from "@/components/commerce/cart";
import { useBrandPathname } from "@/lib/brand/use-brand-pathname";
import { BASKET } from "@/brands/beauty/copy/site";

/**
 * The header's basket pill: how many things are in the basket, and a way to
 * it. The basket lives on the home page and on /clinics, so on /clinics it
 * stays on the page. The count shows once the stored basket has been read,
 * so it never flashes a wrong number.
 */
export function BasketLink() {
  const { count, hydrated } = useCart();
  const pathname = useBrandPathname();
  const href = pathname === "/clinics" ? "#basket" : "/#basket";
  const n = hydrated ? count : 0;

  return (
    <Link href={href} className="au-basket" aria-label={BASKET.linkLabel(n)}>
      <span aria-hidden="true">{BASKET.link}</span>
      <span className="au-basket-count" data-filled={n > 0 || undefined} aria-hidden="true">
        {n}
      </span>
    </Link>
  );
}
