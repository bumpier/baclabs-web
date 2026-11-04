"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCart } from "@/components/commerce/cart";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp } from "@/lib/commerce/view";
import { SEAL } from "@/brands/luxury/components/mark-paths";
import { PRODUCT } from "@/brands/luxury/copy/home";
import { GiftFields, sizeName, useBag } from "./Bag";

/**
 * The product page's purchase column, sticky beside the gallery on a wide
 * screen and under it on a phone: the name, the four sizes as a list with
 * their prices set small, the quantity, the gift option and its note, and
 * "Add to bag", which fills the kit's basket, presses the bag's seal and
 * opens the drawer, where the order is paid for.
 *
 * Every figure comes from the storefront view the root layout gave the
 * basket. Prices are never a saving or a per-vial figure: this house does
 * not sell on price. The quiet service lines and the details below the
 * button are the server's (`children`), so they cost the browser nothing.
 */
export function Purchase({ brandName, children }: { brandName: string; children: ReactNode }) {
  const cart = useCart();
  const { storefront } = cart;
  const { setOpen, press } = useBag();
  const [sku, setSku] = useState<string | null>(storefront.packs.find((p) => p.available)?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const pack = storefront.packs.find((p) => p.sku === sku) ?? null;
  const onRequest = storefront.packs.some((p) => !p.available);
  const addOns = storefront.addOns.filter((a) => a.available);

  return (
    <div className="rv-purchase">
      <h2 id="product-name" className="rv-purchase__name">
        {PRODUCT.name}
      </h2>
      <p className="rv-purchase__lede">{PRODUCT.lede}</p>
      <p className="rv-purchase__price" aria-live="polite">
        {pack ? formatGbp(pack.priceMinor) : ""}
      </p>
      <p className="rv-purchase__intro">{PRODUCT.intro(brandName)}</p>

      <form
        className="rv-purchase__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pack || !pack.available) return;
          cart.add(pack.sku, qty);
          press();
          setAdded(PRODUCT.added(sizeName(pack), qty));
          setOpen(true);
        }}
      >
        <PackPicker
          packs={storefront.packs}
          value={sku}
          onChange={(next) => {
            setSku(next);
            setAdded(null);
          }}
          legend={PRODUCT.sizes}
          classNames={{ fieldset: "rv-sizes", legend: "rv-label", list: "rv-sizes__list", option: "rv-size" }}
          renderPack={(p, { checked, disabled }) => (
            <>
              <svg viewBox="0 0 100 100" className="rv-size__seal" aria-hidden="true" focusable="false">
                <path d={SEAL.edge} className={checked ? "is-on" : undefined} />
              </svg>
              <span className="rv-size__name">{sizeName(p)}</span>
              {p.label ? <span className="rv-size__vials">{PRODUCT.vials(p.vials)}</span> : <span />}
              <span className="rv-size__price">{disabled ? PRODUCT.onRequest : formatGbp(p.priceMinor)}</span>
            </>
          )}
        />
        {onRequest ? (
          <p className="rv-hint">
            {PRODUCT.requestNote}{" "}
            <Link href="/contact" className="rv-link">
              {PRODUCT.requestLink}
            </Link>
            .
          </p>
        ) : null}

        <QuantityStepper
          value={qty}
          onChange={setQty}
          max={storefront.limits.maxLineQty}
          label={PRODUCT.quantity}
          classNames={{
            root: "rv-stepper",
            label: "rv-label rv-stepper__label",
            input: "rv-stepper__input",
            button: "rv-stepper__btn",
          }}
        />

        {storefront.flags.giftNote ? <GiftFields maxLength={storefront.limits.maxGiftNote} /> : null}

        <button type="submit" className="rv-button rv-button--wide rv-button--split" disabled={!pack || !pack.available}>
          <span>{PRODUCT.add}</span>
          {pack && pack.available ? <span className="rv-button__price">{formatGbp(pack.priceMinor * qty)}</span> : null}
        </button>
        <p role="status" className="rv-status">
          {added ?? ""}
        </p>
      </form>

      {addOns.length > 0 ? (
        <section aria-label={PRODUCT.addOnsHeading} className="rv-addons">
          <ul>
            {addOns.map((a) => (
              <li key={a.sku}>
                <span>
                  {a.name}, {formatGbp(a.priceMinor)}
                  {a.contents ? <span className="rv-hint block">{a.contents}</span> : null}
                </span>
                <button
                  type="button"
                  className="rv-text-button"
                  onClick={() => {
                    cart.add(a.sku);
                    press();
                    setOpen(true);
                  }}
                >
                  {PRODUCT.addOnAdd}
                  <span className="sr-only"> {a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children}
    </div>
  );
}
