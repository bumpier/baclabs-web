"use client";

import { useEffect, useId, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { formatGbp } from "@/lib/commerce/view";
import { BAR } from "@/brands/gym/copy/home";
import { CART } from "@/brands/gym/copy/site";
import { useShop } from "./ShopProvider";

/** What hides the bar while it is on screen: the hero's button, the product grid, the footer. */
const WATCHED = ["hero-cta", "shop", "site-footer"];

/**
 * The phone's add-to-cart bar, fixed to the bottom of the screen below the md
 * breakpoint, on the home page. It shows once the hero's button has scrolled
 * away and steps aside whenever the product grid or the footer is in view,
 * so it never doubles the buttons on screen or covers the legal links.
 *
 * Empty cart: a pack picker (a native select, every pack on sale with its
 * price) and "Add", which puts the pack in and slides the cart out. With
 * something in the cart: the count and the subtotal, and "View cart". While
 * hidden it is inert, so it never takes keyboard focus off screen.
 */
export function StickyBar({ defaultSku }: { defaultSku: string | null }) {
  const cart = useCart();
  const shop = useShop();
  const pickId = useId();
  const [shown, setShown] = useState(false);
  const [sku, setSku] = useState(defaultSku);

  useEffect(() => {
    const els = WATCHED.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const inView = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView.set(e.target, e.isIntersecting);
      setShown(![...inView.values()].some(Boolean));
    });
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);

  const { storefront, priced } = cart;
  const packs = storefront.packs.filter((p) => p.available);
  const pack = packs.find((p) => p.sku === sku) ?? packs[0] ?? null;
  const empty = priced.items.length === 0;
  const items = priced.items.reduce((n, i) => n + i.qty, 0);

  if (!cart.hydrated || (empty && !pack)) return null;

  return (
    <aside aria-label={BAR.label} className="gym-bar no-print" data-shown={(shown && !shop.open) || undefined} inert={!shown || shop.open}>
      <div className="gym-tape gym-tape-thin" aria-hidden="true" />
      <div className="gym-bar-row">
        {empty && pack ? (
          <>
            <label htmlFor={pickId} className="sr-only">
              {BAR.pack}
            </label>
            <select id={pickId} className="gym-bar-select" value={pack.sku} onChange={(e) => setSku(e.target.value)}>
              {packs.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {BAR.option(p.vials, formatGbp(p.priceMinor))}
                </option>
              ))}
            </select>
            <button type="button" className="gym-btn gym-btn-hazard gym-bar-btn" onClick={() => shop.addAndShow(pack.sku, CART.added(pack.vials))}>
              {BAR.add}
            </button>
          </>
        ) : (
          <>
            <p className="gym-bar-summary">{BAR.summary(items, formatGbp(priced.goodsMinor))}</p>
            <button type="button" className="gym-btn gym-btn-hazard gym-bar-btn" onClick={shop.openCart}>
              {BAR.view}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
