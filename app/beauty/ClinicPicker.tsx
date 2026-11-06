"use client";

import { useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, shipsFree, type PackView } from "@/lib/commerce/view";
import { BASKET, packName, perVial } from "@/brands/beauty/copy/site";
import { CLINICS } from "@/brands/beauty/copy/clinics";
import { useBasketDrawer } from "@/brands/beauty/components/basket-drawer";

/**
 * The clinic price list: each pack a row (the kit's PackPicker, native
 * radios), with its contents, its price a vial and its price, and a note on
 * the packs whose price alone clears free delivery, decided from the
 * catalogue's threshold. Then how many packs, and "Add to basket", which
 * opens the basket drawer.
 */
export function ClinicPicker({ packs }: { packs: readonly PackView[] }) {
  const cart = useCart();
  const drawer = useBasketDrawer();
  const { limits } = cart.storefront;
  const freeOption = cart.storefront.delivery.options.find((o) => o.overThreshold === "free") ?? null;
  // The largest pack on sale leads: this page is for those who order in number.
  const onSale = packs.filter((p) => p.available);
  const [sku, setSku] = useState<string | null>(onSale[onSale.length - 1]?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [said, setSaid] = useState("");

  const chosen = packs.find((p) => p.sku === sku) ?? null;
  const max = chosen ? Math.max(1, Math.min(limits.maxLineQty, Math.floor(limits.maxVials / chosen.vials))) : 1;

  return (
    <form
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
        legend={CLINICS.legend}
        classNames={{ list: "grid gap-1.5", option: "bb-row" }}
        renderPack={(pack) => (
          <>
            <span className="bb-dot" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-display text-[1.375rem] leading-tight">{CLINICS.packName(pack.vials)}</span>
              <span className="bb-fine block">{CLINICS.packContents(pack.vials)}</span>
              {freeOption && shipsFree(cart.storefront, pack.priceMinor) ? (
                <span className="bb-fine block">{CLINICS.freeDelivery(freeOption.label)}</span>
              ) : null}
            </span>
            <span className="text-right">
              <span className="bb-price block text-[1.5rem]">{formatGbp(pack.priceMinor)}</span>
              {pack.vials > 1 ? <span className="bb-fine block">{perVial(pack.perVialMinor)}</span> : null}
            </span>
          </>
        )}
      />

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={qty}
          onChange={(n) => {
            setQty(n);
            setSaid("");
          }}
          max={max}
          label={CLINICS.quantity}
          classNames={{ root: "bb-qty", button: "bb-step", input: "bb-count" }}
        />
        {/* On the narrowest phones the button keeps to one row beside the
            stepper by leaving the total to the price list above it. */}
        <button type="submit" className="btn-cta min-w-[10rem] flex-1 justify-center min-[440px]:justify-between" disabled={!chosen}>
          <span>{CLINICS.add}</span>
          {chosen ? (
            <span className="hidden font-display text-[1.125rem] font-normal min-[440px]:inline">{formatGbp(chosen.priceMinor * qty)}</span>
          ) : null}
        </button>
      </div>
      <p role="status" className="sr-only">
        {said}
      </p>
    </form>
  );
}
