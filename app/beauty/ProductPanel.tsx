"use client";

import { useState, type ReactNode } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, type PackView } from "@/lib/commerce/view";
import { BASKET, packName, perVial } from "@/brands/beauty/copy/site";
import { ESSENTIALS } from "@/brands/beauty/copy/home";
import { useBasketDrawer } from "@/brands/beauty/components/basket-drawer";
import { BoxIcon } from "@/brands/beauty/components/icons";

/**
 * The Essentials' purchase panel, beside the gallery: the name, the chosen
 * size's price, the four sizes as tiles (the kit's PackPicker, native
 * radios; the chosen tile takes the seal), the quantity, and "Add to
 * basket", which opens the basket drawer with the new line marked.
 * `children` is the server's part below it: delivery and returns, folded.
 *
 * Every figure is the storefront view's, handed down by the page; the
 * checkout prices it again from the catalogue.
 */
export function ProductPanel({ packs, children }: { packs: readonly PackView[]; children?: ReactNode }) {
  const cart = useCart();
  const drawer = useBasketDrawer();
  const { limits } = cart.storefront;
  const firstOnSale = packs.find((p) => p.available) ?? null;
  // The set of five leads: the first set, between a single vial and the larger sizes.
  const preferred = packs.find((p) => p.available && p.vials === 5) ?? firstOnSale;
  const [sku, setSku] = useState<string | null>(preferred?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [said, setSaid] = useState("");

  const chosen = packs.find((p) => p.sku === sku) ?? null;
  const max = chosen ? Math.max(1, Math.min(limits.maxLineQty, Math.floor(limits.maxVials / chosen.vials))) : 1;

  return (
    <div>
      <h2 id="essentials-title" className="bb-h2">
        {ESSENTIALS.title}
      </h2>
      <p className="bb-small mt-3">{ESSENTIALS.subtitle}</p>

      {chosen ? (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
          <span className="bb-price text-[2.5rem]">{formatGbp(chosen.priceMinor)}</span>
          {chosen.vials > 1 ? <span className="bb-small">{perVial(chosen.perVialMinor)}</span> : null}
        </p>
      ) : null}

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen) return;
          cart.add(chosen.sku, qty);
          setSaid(BASKET.added(packName(chosen.vials)));
          drawer.show(chosen.sku);
        }}
      >
        <PackPicker
          packs={packs}
          value={sku}
          onChange={(next) => {
            setSku(next);
            setQty(1);
            setSaid("");
          }}
          legend={ESSENTIALS.sizeLegend}
          classNames={{ legend: "label mb-3 block", list: "bb-sizes", option: "bb-size" }}
          renderPack={(pack) => (
            <>
              <span className="font-display text-[1.125rem] leading-tight min-[400px]:text-[1.25rem]">{ESSENTIALS.sizeName(pack.vials)}</span>
              <span className="mt-1 text-[0.9375rem] font-semibold">{formatGbp(pack.priceMinor)}</span>
              <span className="bb-fine">{pack.vials > 1 ? perVial(pack.perVialMinor) : ESSENTIALS.contents(1)}</span>
            </>
          )}
        />

        <p className="bb-small mt-5 flex items-center gap-2.5">
          <BoxIcon className="shrink-0 text-rose" />
          {ESSENTIALS.box}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={qty}
            onChange={(n) => {
              setQty(n);
              setSaid("");
            }}
            max={max}
            label={ESSENTIALS.quantity}
            classNames={{ root: "bb-qty", button: "bb-step", input: "bb-count" }}
          />
          {/* On the narrowest phones the button keeps to one row beside the
              stepper by leaving the total to the price above it. */}
          <button type="submit" className="btn-cta min-w-[10rem] flex-1 justify-center min-[440px]:justify-between" disabled={!chosen}>
            <span>{ESSENTIALS.add}</span>
            {chosen ? (
              <span className="hidden font-display text-[1.125rem] font-normal min-[440px]:inline">{formatGbp(chosen.priceMinor * qty)}</span>
            ) : null}
          </button>
        </div>
        <p role="status" className="sr-only">
          {said}
        </p>
      </form>

      <p className="bb-small mt-5">{ESSENTIALS.sentFrom}</p>

      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  );
}
