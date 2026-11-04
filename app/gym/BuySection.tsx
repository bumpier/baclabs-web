"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor } from "@/lib/commerce/view";

const vials = (n: number) => (n === 1 ? "1 vial" : `${n} vials`);

/**
 * A plain buy section until the brand's design lands: choose a pack and a
 * count, add it to the basket, check out. Every figure comes from the
 * storefront view the root layout gave the basket; the checkout prices the
 * order again from the catalogue, and its answer is shown as it stands.
 */
export function BuySection() {
  const cart = useCart();
  const { storefront, priced } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [sku, setSku] = useState<string | null>(storefront.packs.find((p) => p.available)?.sku ?? null);
  const [qty, setQty] = useState(1);
  const headingId = useId();
  const basketId = useId();

  const empty = priced.items.length === 0;
  const delivery = deliveryQuote(storefront, priced.goodsMinor);
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const addOns = storefront.addOns.filter((a) => a.available);
  const quoteOnly = storefront.packs.some((p) => !p.available);
  const message = error ?? priced.problem;
  const methods = storefront.payment.methods;

  return (
    <section id="buy" aria-labelledby={headingId} className="mt-12 scroll-mt-8">
      <h2 id={headingId} className="font-display text-3xl text-ink">
        Order
      </h2>

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (sku) cart.add(sku, qty);
        }}
      >
        <PackPicker
          packs={storefront.packs}
          value={sku}
          onChange={setSku}
          legend="Pack size"
          renderPack={(pack, { disabled }) => (
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium text-ink">
                {pack.label || vials(pack.vials)}
                {pack.label ? <span className="ml-2 text-ink-soft">{vials(pack.vials)}</span> : null}
              </span>
              <span className="text-ink">
                {disabled ? "Quote only" : formatGbp(pack.priceMinor)}
                {disabled ? null : <span className="ml-2 text-sm text-ink-soft">{formatGbp(pack.perVialMinor)} a vial</span>}
              </span>
            </span>
          )}
        />
        {quoteOnly ? (
          <p className="text-sm text-ink-soft">
            Packs marked quote only are not ordered online.{" "}
            <Link href="/contact?topic=wholesale" className="link">
              Ask us for a quote
            </Link>
            .
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <QuantityStepper value={qty} onChange={setQty} max={storefront.limits.maxLineQty} label="Quantity" />
          <button type="submit" className="btn-quiet" disabled={!sku}>
            Add to basket
          </button>
        </div>
      </form>

      {addOns.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {addOns.map((a) => (
            <li key={a.sku} className="commerce-panel flex flex-wrap items-center justify-between gap-4 p-4">
              <span>
                <span className="block font-medium text-ink">
                  {a.name}, {formatGbp(a.priceMinor)}
                </span>
                {a.contents ? <span className="block text-sm text-ink-soft">{a.contents}</span> : null}
              </span>
              <button type="button" className="btn-quiet" onClick={() => cart.add(a.sku)}>
                Add<span className="sr-only"> {a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby={basketId} className="commerce-panel mt-10 p-5">
        <h3 id={basketId} className="text-lg font-semibold text-ink">
          Basket
        </h3>
        {!cart.hydrated ? null : empty ? (
          <p className="mt-3 text-ink-soft">Your basket is empty.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {priced.items.map((item) => {
              const name = item.kind === "pack" ? item.pack.label || vials(item.pack.vials) : item.addOn.name;
              return (
                <li key={item.sku} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-32 font-medium text-ink">{name}</span>
                  <QuantityStepper
                    value={item.qty}
                    onChange={(n) => cart.set(item.sku, n)}
                    max={storefront.limits.maxLineQty}
                    label={`Quantity of ${name}`}
                  />
                  <span className="text-ink">{formatGbp(item.lineMinor)}</span>
                  <button type="button" className="link text-sm" onClick={() => cart.remove(item.sku)}>
                    Remove<span className="sr-only"> {name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!empty ? (
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-4 text-base font-semibold text-ink">
              <dt>Subtotal</dt>
              <dd>{formatGbp(priced.goodsMinor)}</dd>
            </div>
            {delivery.map(({ option, priceMinor }) => (
              <div key={option.id} className="flex justify-between gap-4 text-ink-soft">
                <dt>
                  {option.label}: {option.detail}
                </dt>
                <dd>{priceMinor === 0 ? "Free" : formatGbp(priceMinor)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {!empty && shortfall !== null ? (
          <p className="mt-3 text-sm text-ink-soft">{formatGbp(shortfall)} more and delivery is free.</p>
        ) : null}

        {message ? (
          <p role="alert" className="alert-error mt-4">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-cta mt-5 w-full"
          disabled={empty || pending}
          aria-busy={pending}
          onClick={() => checkout()}
        >
          {pending ? "Going to checkout…" : "Checkout"}
        </button>
        {methods.length > 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Pay by {methods.map((m) => m.label).join(", ")}.</p>
        ) : null}
      </section>
    </section>
  );
}
