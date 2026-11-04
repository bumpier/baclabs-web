"use client";

import { useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { formatGbp } from "@/lib/commerce/view";
import { KIT } from "@/brands/gym/copy/home";
import { useOrder } from "./OrderProvider";

/**
 * The Lab Kit, offered beside the basket: its name, its parts and its price,
 * all from the storefront view. Only what the view says is on sale is
 * offered: while NEXT_PUBLIC_LAB_KIT is off the kit is listed as
 * unavailable, and this renders nothing at all.
 *
 * The checkout takes at most one kit per vial (AddOnView.perVial), so the
 * button follows the basket: with no vials in it yet it adds the pack
 * chosen on the ladder together with a kit; with room it adds a kit; at the
 * limit it says so and stays put. Anything sold beside the packs that has no
 * such limit is a plain add.
 */
export function LabKitOffer() {
  const cart = useCart();
  const order = useOrder();
  const { storefront, priced } = cart;
  const [status, setStatus] = useState("");
  const offers = storefront.addOns.filter((a) => a.available);
  const pack = storefront.packs.find((p) => p.sku === order.sku && p.available) ?? null;

  if (offers.length === 0) return null;

  return (
    <div className="space-y-3">
      {offers.map((a) => {
        const noVials = a.perVial && priced.vials === 0;
        const maxed = a.perVial && priced.vials > 0 && priced.kits >= priced.vials;
        const label = noVials ? (pack ? KIT.addWith(pack.vials) : KIT.add) : KIT.add;
        return (
          <section key={a.sku} aria-labelledby={`kit-${a.sku}`} className="gym-kit gym-chalk">
            <div className="gym-kit-head">
              <h3 id={`kit-${a.sku}`} className="gym-kit-name">
                {a.name}
              </h3>
              <p className="gym-kit-price gym-figure">{formatGbp(a.priceMinor)}</p>
            </div>
            {a.contents ? <p className="gym-kit-contents">{a.contents}.</p> : null}
            <p className="gym-kit-lead">
              {KIT.lead}
              {a.perVial ? ` ${KIT.limit}` : ""}
            </p>
            <button
              type="button"
              className="gym-btn gym-btn-ink mt-4 w-full sm:w-auto"
              disabled={maxed || (noVials && !pack)}
              onClick={() => {
                if (noVials && pack) cart.add(pack.sku);
                cart.add(a.sku);
                setStatus(KIT.added);
              }}
            >
              {label}
              <span className="sr-only">, {formatGbp(a.priceMinor)}</span>
            </button>
            {maxed ? <p className="gym-kit-note">{KIT.maxed}</p> : null}
            <p role="status" className="gym-status">
              {status}
            </p>
          </section>
        );
      })}
    </div>
  );
}
