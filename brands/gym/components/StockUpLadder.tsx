"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, packSavingMinor } from "@/lib/commerce/view";
import { LADDER } from "@/brands/gym/copy/home";
import { useOrder } from "./OrderProvider";
import { Plates, plateCount } from "./Plates";

/**
 * The stock-up ladder: every pack in the catalogue as one rung, smallest
 * first, each with its vials drawn as plates, its price, its price a vial
 * and what it saves against the smallest pack on sale (packSavingMinor).
 * Nothing is typed here: change a price in brands/gym/catalogue.ts and every
 * figure follows.
 *
 * A native radio group (the kit's PackPicker), so arrow keys and screen
 * readers work as they do anywhere. The chosen rung turns hazard orange and
 * its square fills, so the choice never rests on colour alone. The rung's
 * text is its accessible name.
 */
export function StockUpLadder() {
  const cart = useCart();
  const order = useOrder();
  const { storefront } = cart;
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState("");

  const packs = storefront.packs;
  const base = packs.find((p) => p.available) ?? null;
  const unit = base?.vials ?? packs[0]?.vials ?? 1;
  const most = Math.max(1, ...packs.map((p) => plateCount(p.vials, unit)));
  const chosen = packs.find((p) => p.sku === order.sku && p.available) ?? null;
  const quoteOnly = packs.some((p) => !p.available);
  const anySaving = packs.some((p) => p.available && packSavingMinor(storefront, p) > 0);

  if (packs.length === 0) return null;

  return (
    <div>
      <PackPicker
        packs={packs}
        value={chosen?.sku ?? null}
        onChange={(sku) => {
          order.setSku(sku);
          setStatus("");
        }}
        legend={LADDER.legend}
        classNames={{ list: "gym-ladder", option: "gym-rung" }}
        renderPack={(pack, { disabled }) => {
          const saving = disabled ? 0 : packSavingMinor(storefront, pack);
          return (
            <>
              <span className="gym-rung-count">
                <span className="gym-figure gym-rung-n">{pack.vials}</span>
                <span className="gym-rung-unit">{LADDER.count(pack.vials)}</span>
              </span>
              {pack.label ? <span className="gym-rung-badge">{pack.label}</span> : null}
              <Plates count={plateCount(pack.vials, unit)} max={most} />
              <span className="gym-rung-price gym-figure">{disabled ? LADDER.offline : formatGbp(pack.priceMinor)}</span>
              {disabled ? null : (
                <span className="gym-rung-meta">
                  <span>{LADDER.perVial(formatGbp(pack.perVialMinor))}</span>
                  {saving > 0 ? <span className="gym-rung-save">{LADDER.save(formatGbp(saving))}</span> : null}
                </span>
              )}
              <span className="gym-tick" aria-hidden="true" />
            </>
          );
        }}
      />

      <div className="gym-ladder-foot">
        {anySaving && base ? <p>{LADDER.basis(base.vials)}</p> : null}
        {quoteOnly ? (
          <p>
            {LADDER.quoteNote}{" "}
            <Link href="/contact" className="gym-link">
              {LADDER.quote}
            </Link>
            .
          </p>
        ) : null}
      </div>

      <form
        className="gym-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen) return;
          cart.add(chosen.sku, qty);
          setStatus(LADDER.added(chosen.vials, qty));
          setQty(1);
        }}
      >
        <QuantityStepper
          value={qty}
          onChange={setQty}
          max={storefront.limits.maxLineQty}
          label={LADDER.quantity}
          classNames={{ root: "gym-stepper", button: "gym-stepper-btn", input: "gym-stepper-input" }}
        />
        <button type="submit" className="gym-btn gym-btn-lg" disabled={!chosen}>
          <span>{LADDER.add}</span>
          {chosen ? <span className="gym-figure">{formatGbp(chosen.priceMinor * qty)}</span> : null}
        </button>
      </form>
      <p role="status" className="gym-status">
        {status}
      </p>
    </div>
  );
}
