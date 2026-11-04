"use client";

import { useCart } from "@/components/commerce/cart";
import { BASKET } from "@/brands/beauty/copy/site";
import { useBasketDrawer } from "./basket-drawer";
import { PouchIcon } from "./icons";

/**
 * The header's basket: the pouch icon, the word on wide screens, and the
 * count, which takes the seal's blue once something is in the basket and
 * lifts each time it changes. It opens the basket drawer on every page.
 * The count shows once the stored basket has been read, so it never
 * flashes a wrong number.
 */
export function BasketButton() {
  const { count, hydrated } = useCart();
  const drawer = useBasketDrawer();
  const n = hydrated ? count : 0;

  return (
    <button
      type="button"
      className="au-basket -mr-1.5"
      aria-label={BASKET.linkLabel(n)}
      aria-haspopup="dialog"
      aria-expanded={drawer.open}
      onClick={() => drawer.show()}
    >
      <PouchIcon />
      <span className="hidden sm:inline" aria-hidden="true">
        {BASKET.link}
      </span>
      <span key={n} className="au-count-badge" data-filled={n > 0 || undefined} aria-hidden="true">
        {n}
      </span>
    </button>
  );
}
