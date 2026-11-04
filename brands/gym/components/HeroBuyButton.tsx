"use client";

import { useCart } from "@/components/commerce/cart";
import { useOrder } from "./OrderProvider";

/**
 * The hero's one action: put the headline's pack in the basket and go to
 * the basket, where the Lab Kit offer and the checkout are. The pack, its
 * label and its price are the server's, from the storefront view.
 *
 * The basket's heading takes focus, so a keyboard or screen-reader user
 * lands where the page moved to, and the sticky bar's observer sees the
 * button leave the screen.
 */
export function HeroBuyButton({ sku, label, price }: { sku: string; label: string; price: string }) {
  const cart = useCart();
  const order = useOrder();
  return (
    <button
      id="hero-buy"
      type="button"
      className="gym-btn gym-btn-xl w-full"
      onClick={() => {
        cart.add(sku);
        order.setSku(sku);
        const heading = document.getElementById("buy-heading");
        heading?.scrollIntoView({ block: "start" });
        heading?.focus({ preventScroll: true });
      }}
    >
      <span>{label}</span>
      <span className="gym-figure">{price}</span>
    </button>
  );
}
