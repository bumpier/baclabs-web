"use client";

import { useId, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, type PackView } from "@/lib/commerce/view";
import { BASKET, packName, perVial } from "@/brands/beauty/copy/site";
import { ESSENTIALS } from "@/brands/beauty/copy/home";
import { Pouch } from "@/brands/beauty/components/Pouch";

/**
 * Choosing a set of the Essentials: the pouch on the left fills with the
 * chosen set's vials, the three sets on the right are the kit's PackPicker
 * (native radios), and the set goes into the basket below. Every figure is
 * the storefront view's, handed down by the page; the checkout prices it
 * again from the catalogue.
 */
export function EssentialsPicker({ packs }: { packs: readonly PackView[] }) {
  const cart = useCart();
  const { limits } = cart.storefront;
  const firstOnSale = packs.find((p) => p.available) ?? null;
  // The set of three leads, as the middle of the range; the first on sale otherwise.
  const preferred = packs.find((p) => p.available && p.vials === 3) ?? firstOnSale;
  const [sku, setSku] = useState<string | null>(preferred?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // The pouch moves only in answer to a choice, never on first paint.
  const [changed, setChanged] = useState(false);
  const pouchId = useId();

  const chosen = packs.find((p) => p.sku === sku) ?? null;
  const max = chosen ? Math.max(1, Math.min(limits.maxLineQty, Math.floor(limits.maxVials / chosen.vials))) : 1;

  return (
    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
      <div className="mx-auto w-full max-w-[17rem] md:max-w-[23rem]">
        <div className="relative aspect-square rounded-full bg-paper/80">
          <Pouch
            count={chosen?.vials ?? 1}
            idPrefix={pouchId}
            label={ESSENTIALS.artLabel(chosen?.vials ?? 1)}
            animate={changed}
            className="absolute inset-[10%] h-[80%] w-[80%]"
          />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen) return;
          cart.add(chosen.sku, qty);
          setAdded(true);
        }}
      >
        <PackPicker
          packs={packs}
          value={sku}
          onChange={(next) => {
            setSku(next);
            setQty(1);
            setAdded(false);
            setChanged(true);
          }}
          legend={ESSENTIALS.legend}
          classNames={{ list: "grid gap-3", option: "au-set" }}
          renderPack={(pack) => (
            <>
              <span className="au-dot" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-display text-[1.375rem] leading-tight">{packName(pack.vials)}</span>
                <span className="au-small block">{ESSENTIALS.contents(pack.vials)}</span>
                {pack.vials > 1 ? <span className="au-small block">{perVial(pack.perVialMinor)}</span> : null}
              </span>
              <span className="au-price text-[1.625rem] sm:text-[1.875rem]">{formatGbp(pack.priceMinor)}</span>
            </>
          )}
        />

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4">
          <QuantityStepper
            value={qty}
            onChange={(n) => {
              setQty(n);
              setAdded(false);
            }}
            max={max}
            label={ESSENTIALS.quantity}
            classNames={{ root: "inline-flex items-center gap-1", button: "au-step", input: "au-count" }}
          />
          <button type="submit" className="btn-cta min-w-[12rem] flex-1 sm:flex-none" disabled={!chosen}>
            {ESSENTIALS.add}
          </button>
        </div>
        <p role="status" className="mt-4 min-h-[1.6em] text-[0.9375rem]">
          {added ? (
            <>
              {BASKET.added}{" "}
              <a href="#basket" className="au-link font-semibold">
                {BASKET.seeBasket}
              </a>
            </>
          ) : null}
        </p>
      </form>
    </div>
  );
}
