"use client";

import { useId, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor } from "@/lib/commerce/view";
import { BASKET, packName } from "@/brands/beauty/copy/site";

/**
 * The basket, as a porcelain panel (#basket): its lines with their counts,
 * the subtotal, the delivery choice and the way to pay. The same basket on
 * every page (the root layout's CartProvider), so a clinic pack added on
 * /clinics shows here too.
 *
 * Figures come from the storefront view; the checkout prices the order
 * again from the catalogue and its refusal is shown word for word. While
 * the view lists no way to pay there is no checkout button at all.
 */
export function Basket() {
  const cart = useCart();
  const { storefront, priced } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const headingId = useId();
  const deliveryName = useId();

  const empty = priced.items.length === 0;
  const delivery = deliveryQuote(storefront, priced.goodsMinor);
  // The first option offered, unless the buyer picked another that is still
  // offered at this basket's value.
  const chosen = delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const message = error ?? priced.problem;
  const methods = storefront.payment.methods;
  const pay = (method: string) => checkout({ deliveryOption: chosen?.option.id, method });

  return (
    <section id="basket" aria-labelledby={headingId} className="au-panel scroll-mt-6 p-6 sm:p-8">
      <h3 id={headingId} className="au-h3">
        {BASKET.heading}
      </h3>

      {!cart.hydrated ? null : empty ? (
        <p className="au-small mt-3">{BASKET.empty}</p>
      ) : (
        <ul className="mt-5 space-y-5">
          {priced.items.map((item) => {
            const name = item.kind === "pack" ? packName(item.pack.vials) : item.addOn.name;
            return (
              <li key={item.sku} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                <span className="font-display text-[1.25rem] leading-tight">{name}</span>
                <span className="au-price text-right text-[1.25rem]">{formatGbp(item.lineMinor)}</span>
                <QuantityStepper
                  value={item.qty}
                  onChange={(n) => cart.set(item.sku, n)}
                  max={storefront.limits.maxLineQty}
                  label={BASKET.quantityOf(name)}
                  classNames={{ root: "inline-flex items-center gap-1", button: "au-step", input: "au-count" }}
                />
                <button type="button" className="au-link justify-self-end text-[0.9375rem]" onClick={() => cart.remove(item.sku)}>
                  {BASKET.remove}
                  <span className="sr-only"> {name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!empty ? (
        <>
          <dl className="mt-6 rounded-[1.125rem] bg-blush/60 px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">{BASKET.subtotal}</dt>
              <dd className="au-price text-[1.5rem]">{formatGbp(priced.goodsMinor)}</dd>
            </div>
          </dl>

          {delivery.length > 0 ? (
            <fieldset className="mt-5">
              <legend className="mb-3 font-semibold">{BASKET.delivery}</legend>
              <div className="space-y-2">
                {delivery.map(({ option, priceMinor }) => {
                  const checked = chosen?.option.id === option.id;
                  return (
                    <label key={option.id} className="au-choice" data-checked={checked || undefined}>
                      <input
                        type="radio"
                        name={deliveryName}
                        value={option.id}
                        checked={checked}
                        onChange={() => setDeliveryId(option.id)}
                        className="sr-only"
                      />
                      <span className="au-dot mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{option.label}</span>
                        <span className="au-small block">{option.detail}</span>
                      </span>
                      <span className="shrink-0 font-semibold">{priceMinor === 0 ? BASKET.free : formatGbp(priceMinor)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {shortfall !== null ? <p className="au-small mt-3">{BASKET.shortfall(shortfall)}</p> : null}
        </>
      ) : null}

      {message ? (
        <p role="alert" className="alert-error mt-5">
          {message}
        </p>
      ) : null}

      {methods.length === 1 ? (
        <>
          <button
            type="button"
            className="btn-cta mt-6 w-full"
            disabled={empty || pending}
            aria-busy={pending}
            onClick={() => pay(methods[0]!.id)}
          >
            {pending ? BASKET.pending : BASKET.checkout}
          </button>
          <p className="au-small mt-3 text-center">{BASKET.payBy(methods[0]!.label)}</p>
        </>
      ) : methods.length > 1 ? (
        <div className="mt-6 space-y-3">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              className="btn-cta w-full"
              disabled={empty || pending}
              aria-busy={pending}
              onClick={() => pay(m.id)}
            >
              {pending ? BASKET.pending : BASKET.payWith(m.label)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
