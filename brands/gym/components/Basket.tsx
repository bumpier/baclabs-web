"use client";

import { useId } from "react";
import { useCart } from "@/components/commerce/cart";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, freeDeliveryShortfallMinor } from "@/lib/commerce/view";
import { BASKET } from "@/brands/gym/copy/home";
import { LabKitOffer } from "./LabKitOffer";
import { useOrder } from "./OrderProvider";

const STEPPER = { root: "gym-stepper gym-stepper-sm", button: "gym-stepper-btn", input: "gym-stepper-input" };

/**
 * The basket and the till: the lines, the Lab Kit offer, the delivery, the
 * total and the checkout. It is #buy, where an unfinished payment returns
 * (the checkout's cancel address) and where the checkout's refusals are
 * shown, word for word, in one role="alert".
 *
 * Every figure is the storefront view's, priced by the checkout's own rules
 * (priceBasket, deliveryQuote); the checkout prices the order again and is
 * the authority. With no way to pay in the view there is no checkout button
 * at all.
 */
export function Basket() {
  const cart = useCart();
  const order = useOrder();
  const { storefront, priced } = cart;
  const deliveryName = useId();

  const empty = priced.items.length === 0;
  const methods = storefront.payment.methods;
  const { delivery, deliveryOptions } = order;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const freeOption = storefront.delivery.options.find((o) => o.overThreshold === "free") ?? null;
  // The checkout refuses more kits than vials as "Invalid order details";
  // say what is actually wrong.
  const tooManyKits = priced.vials > 0 && priced.kits > priced.vials;
  const message = order.error ?? (tooManyKits ? BASKET.tooManyKits : priced.problem);
  const total = priced.goodsMinor + (delivery?.priceMinor ?? 0);

  return (
    <section id="buy" aria-labelledby="buy-heading" className="gym-basket">
      <div className="gym-wrap">
        <h2 id="buy-heading" tabIndex={-1} className="gym-h2">
          {BASKET.heading}
        </h2>

        <div className="gym-basket-grid">
          <div>
            {!cart.hydrated ? null : empty ? (
              <p className="gym-basket-empty">{BASKET.empty}</p>
            ) : (
              <ul className="gym-lines">
                {priced.items.map((item) => {
                  const name = item.kind === "pack" ? BASKET.pack(item.pack.vials, item.pack.label) : item.addOn.name;
                  const max =
                    item.kind === "addOn" && item.addOn.perVial
                      ? Math.max(1, Math.min(storefront.limits.maxLineQty, priced.vials))
                      : storefront.limits.maxLineQty;
                  return (
                    <li key={item.sku} className="gym-line">
                      <span className="gym-line-name">{name}</span>
                      <QuantityStepper
                        value={item.qty}
                        onChange={(n) => cart.set(item.sku, n)}
                        max={max}
                        label={BASKET.quantityOf(name)}
                        classNames={STEPPER}
                      />
                      <span className="gym-line-total gym-figure">{formatGbp(item.lineMinor)}</span>
                      <button type="button" className="gym-line-remove" onClick={() => cart.remove(item.sku)}>
                        {BASKET.remove}
                        <span className="sr-only"> {name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-6">
              <LabKitOffer />
            </div>
          </div>

          <div className="gym-till">
            {!empty && deliveryOptions.length > 1 ? (
              <fieldset className="gym-delivery">
                <legend className="gym-till-label">{BASKET.delivery}</legend>
                {deliveryOptions.map(({ option, priceMinor }) => (
                  <label key={option.id} className="gym-delivery-option" data-checked={delivery?.option.id === option.id || undefined}>
                    <input
                      type="radio"
                      name={deliveryName}
                      value={option.id}
                      checked={delivery?.option.id === option.id}
                      onChange={() => order.setDeliveryId(option.id)}
                      className="sr-only"
                    />
                    <span className="gym-delivery-text">
                      <span className="gym-delivery-name">{option.label}</span>
                      <span className="gym-delivery-detail">{option.detail}</span>
                    </span>
                    <span className="gym-delivery-price gym-figure">{priceMinor === 0 ? BASKET.free : formatGbp(priceMinor)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            {!empty ? (
              <dl className="gym-totals">
                <div>
                  <dt>{BASKET.subtotal}</dt>
                  <dd className="gym-figure">{formatGbp(priced.goodsMinor)}</dd>
                </div>
                {delivery ? (
                  <div>
                    <dt>
                      {BASKET.delivery}
                      {deliveryOptions.length === 1 ? <span className="gym-totals-detail">{delivery.option.detail}</span> : null}
                    </dt>
                    <dd className="gym-figure">{delivery.priceMinor === 0 ? BASKET.free : formatGbp(delivery.priceMinor)}</dd>
                  </div>
                ) : null}
                <div className="gym-totals-grand">
                  <dt>{BASKET.total}</dt>
                  <dd className="gym-figure">{formatGbp(total)}</dd>
                </div>
              </dl>
            ) : null}

            {!empty && shortfall !== null && freeOption ? (
              <p className="gym-shortfall">{BASKET.shortfall(formatGbp(shortfall), freeOption.label)}</p>
            ) : null}

            {message ? (
              <p role="alert" className="alert-error gym-alert">
                {message}
              </p>
            ) : null}

            {!empty && methods.length === 1 ? (
              <>
                <button
                  type="button"
                  className="gym-btn gym-btn-xl w-full"
                  disabled={order.pending}
                  aria-busy={order.pending}
                  onClick={() => order.pay(methods[0]!.id)}
                >
                  <span>{order.pending ? BASKET.pending : BASKET.checkout}</span>
                  {order.pending ? null : <span className="gym-figure">{formatGbp(total)}</span>}
                </button>
                <p className="gym-payby">{BASKET.payBy(methods[0]!.label)}</p>
              </>
            ) : !empty && methods.length > 1 ? (
              <div className="space-y-3">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="gym-btn gym-btn-lg w-full"
                    disabled={order.pending}
                    aria-busy={order.pending}
                    onClick={() => order.pay(m.id)}
                  >
                    {order.pending ? BASKET.pending : BASKET.payWith(m.label)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
