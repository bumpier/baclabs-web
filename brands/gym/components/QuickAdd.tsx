"use client";

import { CART } from "@/brands/gym/copy/site";
import { useShop } from "./ShopProvider";

/**
 * A product card's one action: put the pack in the cart and slide the cart
 * out, where the Lab Kit and the checkout are. The pack, its price and the
 * button's words are the server's, from the storefront view. The visible
 * label is short; a hidden suffix says which pack and what it costs, so the
 * accessible name starts with the words on the button.
 */
export function QuickAdd({ sku, vials, label, detail }: { sku: string; vials: number; label: string; detail: string }) {
  const shop = useShop();
  return (
    <button type="button" className="gym-btn gym-btn-ink gym-btn-block" data-sku={sku} onClick={() => shop.addAndShow(sku, CART.added(vials))}>
      {label}
      <span className="sr-only">{detail}</span>
    </button>
  );
}
