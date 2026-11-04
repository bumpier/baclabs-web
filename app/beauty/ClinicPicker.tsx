"use client";

import { useId, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, type PackView } from "@/lib/commerce/view";
import { BASKET, perVial } from "@/brands/beauty/copy/site";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { ClinicTray } from "@/brands/beauty/components/ClinicTray";

/**
 * Choosing a clinic pack: the three sizes as one pill track (the kit's
 * PackPicker, native radios), the tray above filling to the chosen size,
 * and the chosen pack's price and per-vial price beside it. `freeDelivery`
 * is decided by the page from the catalogue's threshold.
 */
export function ClinicPicker({ packs, freeDelivery }: { packs: readonly PackView[]; freeDelivery: boolean }) {
  const cart = useCart();
  const { limits } = cart.storefront;
  const [sku, setSku] = useState<string | null>(packs.find((p) => p.available)?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // The tray moves only in answer to a choice, never on first paint.
  const [changed, setChanged] = useState(false);
  const trayId = useId();

  const chosen = packs.find((p) => p.sku === sku) ?? null;
  const max = chosen ? Math.max(1, Math.min(limits.maxLineQty, Math.floor(limits.maxVials / chosen.vials))) : 1;

  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className="mx-auto w-full max-w-[22rem] md:max-w-[26rem]">
        {chosen ? <ClinicTray count={chosen.vials} idPrefix={trayId} label={CLINICS.artLabel(chosen.vials)} animate={changed} /> : null}
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
          legend={CLINICS.legend}
          classNames={{ legend: "mb-3 block font-semibold", list: "au-segments", option: "au-segment" }}
          renderPack={(pack) => <span>{CLINICS.packOption(pack.vials)}</span>}
        />

        {chosen ? (
          <div className="mt-8" aria-live="polite">
            <p className="au-price text-[3rem] sm:text-[3.5rem]">{formatGbp(chosen.priceMinor)}</p>
            <p className="au-small mt-3">
              {perVial(chosen.perVialMinor)}
              {freeDelivery ? (
                <>
                  <br />
                  {CLINICS.freeDelivery}
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4">
          <QuantityStepper
            value={qty}
            onChange={(n) => {
              setQty(n);
              setAdded(false);
            }}
            max={max}
            label={CLINICS.quantity}
            classNames={{ root: "inline-flex items-center gap-1", button: "au-step", input: "au-count" }}
          />
          <button type="submit" className="btn-cta min-w-[12rem] flex-1 sm:flex-none" disabled={!chosen}>
            {CLINICS.add}
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
