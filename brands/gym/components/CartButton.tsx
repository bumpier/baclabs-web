"use client";

import { useCart } from "@/components/commerce/cart";
import { CART } from "@/brands/gym/copy/site";
import { CartIcon } from "./icons";
import { useShop } from "./ShopProvider";

/**
 * The header's cart, on every page: the box icon and, once the stored cart
 * has been read (so it never flashes a zero), the count on a hazard tab.
 * Opens the slide-out cart (#buy); the count is in the button's name.
 */
export function CartButton() {
  const { count, hydrated } = useCart();
  const shop = useShop();
  const shown = hydrated && count > 0;
  return (
    <button
      type="button"
      className="gym-cart-btn"
      aria-haspopup="dialog"
      aria-controls="buy"
      aria-expanded={shop.open}
      aria-label={shown ? CART.openWith(count) : CART.open}
      onClick={shop.openCart}
    >
      <CartIcon className="gym-cart-icon" />
      <span className="gym-cart-label" aria-hidden="true">
        {CART.open}
      </span>
      {shown ? (
        <span className="gym-cart-count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </button>
  );
}
