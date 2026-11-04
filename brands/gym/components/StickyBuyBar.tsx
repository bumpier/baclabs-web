"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { formatGbp } from "@/lib/commerce/view";
import { BAR, BASKET, LADDER } from "@/brands/gym/copy/home";
import { useOrder } from "./OrderProvider";

/** What hides the bar while it is on screen: the hero's own button, the basket, the footer. */
const WATCHED = ["hero-buy", "buy", "site-footer"];

/**
 * The phone's buy bar, fixed to the bottom of the screen below the md
 * breakpoint. It appears once the hero's button has scrolled away and gets
 * out of the way whenever the basket or the footer is in view, so it never
 * doubles the button the visitor can already see or covers the legal links.
 *
 * Empty basket: the pack chosen on the ladder and its price, and "Add to
 * basket". With something in it: the count and the subtotal, and the
 * checkout, through the page's one checkout (OrderProvider), with the
 * delivery the basket shows. With no way to pay, or several to choose from,
 * the button takes the visitor to the basket instead. While hidden it is
 * inert, so it never takes keyboard focus off screen.
 */
export function StickyBuyBar() {
  const cart = useCart();
  const order = useOrder();
  const [shown, setShown] = useState(false);

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
  const methods = storefront.payment.methods;
  const pack = storefront.packs.find((p) => p.sku === order.sku && p.available) ?? null;
  const empty = priced.items.length === 0;
  const items = priced.items.reduce((n, i) => n + i.qty, 0);

  if (!cart.hydrated || (empty && !pack)) return null;

  const toBasket = () => {
    const heading = document.getElementById("buy-heading");
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  };

  return (
    <aside aria-label={BAR.label} className="gym-bar no-print" data-shown={shown || undefined} inert={!shown}>
      <div className="gym-bar-hazard" aria-hidden="true" />
      <div className="gym-bar-row">
        {empty && pack ? (
          <>
            <p className="gym-bar-what">
              <span className="gym-bar-big">
                <span className="gym-figure">{pack.vials}</span> {LADDER.count(pack.vials)}
              </span>
              <span className="gym-bar-price gym-figure">{formatGbp(pack.priceMinor)}</span>
            </p>
            <button type="button" className="gym-btn gym-bar-btn" onClick={() => cart.add(pack.sku)}>
              {BAR.add}
            </button>
          </>
        ) : (
          <>
            <p className="gym-bar-what">
              <span className="gym-bar-big">{BAR.basket(items)}</span>
              <span className="gym-bar-price gym-figure">{formatGbp(priced.goodsMinor)}</span>
            </p>
            {methods.length === 1 && !priced.problem ? (
              <button
                type="button"
                className="gym-btn gym-bar-btn"
                disabled={order.pending}
                aria-busy={order.pending}
                onClick={() => order.pay(methods[0]!.id)}
              >
                {order.pending ? BASKET.pending : BAR.checkout}
              </button>
            ) : (
              <button type="button" className="gym-btn gym-bar-btn" onClick={toBasket}>
                {BAR.view}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
