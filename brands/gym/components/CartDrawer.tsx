"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { formatGbp, freeDeliveryShortfallMinor, type AddOnView } from "@/lib/commerce/view";
import { CART } from "@/brands/gym/copy/site";
import { PACKSHOTS, photoAt } from "@/brands/gym/copy/images";
import { CloseIcon } from "./icons";
import { useShop } from "./ShopProvider";

const STEPPER = { root: "gym-stepper", button: "gym-stepper-btn", input: "gym-stepper-input" };

/**
 * The slide-out cart, on every page: a native modal <dialog>, so focus is
 * held inside it, Escape closes it, the page behind is inert, and focus goes
 * back to the button that opened it. A click on the dimmed page closes it
 * too. It is #buy, the payment page's cancel address, which opens it.
 *
 * Inside, top to bottom: the free-delivery meter, the lines, the Lab Kit
 * (only while the view lists it on sale), then the till: delivery choice,
 * totals, the checkout's refusal in its own words, and the checkout button.
 * Every figure is the storefront view's, priced by the checkout's own rules
 * (priceBasket, deliveryQuote); the checkout prices the order again and is
 * the authority. With no way to pay in the view there is no button at all.
 */
export function CartDrawer() {
  const cart = useCart();
  const shop = useShop();
  const ref = useRef<HTMLDialogElement>(null);
  const deliveryName = useId();
  const { storefront, priced } = cart;

  // The dialog follows the shop's state, and tells it when Escape closes it.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (shop.open && !d.open) d.showModal();
    if (!shop.open && d.open) d.close();
  }, [shop.open]);

  const empty = priced.items.length === 0;
  const methods = storefront.payment.methods;
  const { delivery, deliveryOptions } = shop;
  const freeOption = storefront.delivery.options.find((o) => o.overThreshold === "free") ?? null;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const from = storefront.delivery.freeFromMinor;
  // The checkout refuses more kits than vials as "Invalid order details";
  // say what is actually wrong.
  const tooManyKits = priced.vials > 0 && priced.kits > priced.vials;
  const message = shop.error ?? (tooManyKits ? CART.tooManyKits : priced.problem);
  const total = priced.goodsMinor + (delivery?.priceMinor ?? 0);
  const count = priced.items.reduce((n, i) => n + i.qty, 0);
  const offers = storefront.addOns.filter((a) => a.available);

  return (
    <dialog
      ref={ref}
      id="buy"
      className="gym-drawer"
      aria-labelledby="cart-heading"
      onClose={shop.closeCart}
      onClick={(e) => {
        if (e.target === e.currentTarget) shop.closeCart();
      }}
    >
      <div className="gym-drawer-panel">
        <div className="gym-tape gym-tape-thin" aria-hidden="true" />
        <div className="gym-drawer-head">
          <h2 id="cart-heading" className="gym-drawer-title">
            {CART.heading}
            {cart.hydrated && count > 0 ? (
              <span className="gym-drawer-count">
                <span aria-hidden="true">{count}</span>
                <span className="sr-only">, {CART.count(count)}</span>
              </span>
            ) : null}
          </h2>
          <button type="button" className="gym-icon-btn" onClick={shop.closeCart}>
            <CloseIcon className="gym-icon" />
            <span className="sr-only">{CART.close}</span>
          </button>
        </div>
        <p role="status" className="sr-only">
          {shop.said}
        </p>

        {!empty && from !== null && freeOption ? (
          <div className="gym-meter">
            <p className="gym-meter-text">
              {shortfall === null ? CART.freeDone(freeOption.label) : CART.shortfall(formatGbp(shortfall), freeOption.label)}
            </p>
            <div
              className="gym-meter-bar"
              role="progressbar"
              aria-label={CART.meter}
              aria-valuemin={0}
              aria-valuemax={from}
              aria-valuenow={Math.min(priced.goodsMinor, from)}
              aria-valuetext={formatGbp(Math.min(priced.goodsMinor, from))}
            >
              <span style={{ clipPath: `inset(0 ${100 - Math.min(100, (priced.goodsMinor / from) * 100)}% 0 0)` }} />
            </div>
          </div>
        ) : null}

        <div className="gym-drawer-body">
          {!cart.hydrated ? null : empty ? (
            <div className="gym-drawer-empty">
              <p className="gym-drawer-empty-title">{CART.empty}</p>
              <p>{CART.emptyLead}</p>
              <Link href="/#shop" className="gym-btn gym-btn-hazard" onClick={shop.closeCart}>
                {CART.shop}
              </Link>
            </div>
          ) : (
            <ul className="gym-lines">
              {priced.items.map((item) => {
                const name = item.kind === "pack" ? CART.pack(item.pack.vials, item.pack.label) : item.addOn.name;
                const max =
                  item.kind === "addOn" && item.addOn.perVial
                    ? Math.max(1, Math.min(storefront.limits.maxLineQty, priced.vials))
                    : storefront.limits.maxLineQty;
                const photo = item.kind === "pack" ? PACKSHOTS[item.pack.vials] : undefined;
                // The thumbnail is 72px wide: the smallest made-ahead copy.
                const thumb = photo ? (photo.widths[0] ?? photo.width) : 0;
                return (
                  <li key={item.sku} className="gym-line">
                    <div className="gym-line-thumb" aria-hidden="true">
                      {photo ? (
                        <Image src={photoAt(photo, thumb)} alt="" width={thumb} height={Math.round((thumb * photo.height) / photo.width)} unoptimized />
                      ) : (
                        <span className="gym-line-tag">{item.kind === "pack" ? item.pack.vials : CART.kitTag}</span>
                      )}
                    </div>
                    <div className="gym-line-main">
                      <p className="gym-line-name">{name}</p>
                      {item.kind === "pack" ? <p className="gym-line-meta">{CART.perVial(formatGbp(item.pack.perVialMinor))}</p> : null}
                      <div className="gym-line-controls">
                        <QuantityStepper
                          value={item.qty}
                          onChange={(n) => cart.set(item.sku, n)}
                          max={max}
                          label={CART.quantityOf(name)}
                          classNames={STEPPER}
                        />
                        <button type="button" className="gym-line-remove" onClick={() => cart.remove(item.sku)}>
                          {CART.remove}
                          <span className="sr-only"> {name}</span>
                        </button>
                      </div>
                    </div>
                    <p className="gym-line-total">{formatGbp(item.lineMinor)}</p>
                  </li>
                );
              })}
            </ul>
          )}

          {!empty ? offers.map((a) => <KitOffer key={a.sku} addOn={a} />) : null}
        </div>

        {!empty ? (
          <div className="gym-drawer-foot">
            {deliveryOptions.length > 1 ? (
              <fieldset className="gym-ship">
                <legend className="gym-ship-legend">{CART.delivery}</legend>
                {deliveryOptions.map(({ option, priceMinor }) => (
                  <label key={option.id} className="gym-ship-option" data-checked={delivery?.option.id === option.id || undefined}>
                    <input
                      type="radio"
                      name={deliveryName}
                      value={option.id}
                      checked={delivery?.option.id === option.id}
                      onChange={() => shop.setDeliveryId(option.id)}
                      className="gym-ship-radio"
                    />
                    <span className="gym-ship-text">
                      <span className="gym-ship-name">{option.label}</span>
                      <span className="gym-ship-detail">{option.detail}</span>
                    </span>
                    <span className="gym-ship-price">{priceMinor === 0 ? CART.free : formatGbp(priceMinor)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <dl className="gym-totals">
              <div>
                <dt>{CART.subtotal}</dt>
                <dd>{formatGbp(priced.goodsMinor)}</dd>
              </div>
              {delivery ? (
                <div>
                  <dt>
                    {CART.delivery}
                    {deliveryOptions.length === 1 ? <span className="gym-totals-detail">{delivery.option.detail}</span> : null}
                  </dt>
                  <dd>{delivery.priceMinor === 0 ? CART.free : formatGbp(delivery.priceMinor)}</dd>
                </div>
              ) : null}
              <div className="gym-totals-grand">
                <dt>{CART.total}</dt>
                <dd>{formatGbp(total)}</dd>
              </div>
            </dl>

            {message ? (
              <p role="alert" className="gym-alert">
                {message}
              </p>
            ) : null}

            {methods.length === 1 ? (
              <>
                <button
                  type="button"
                  className="gym-btn gym-btn-hazard gym-btn-block gym-btn-split"
                  disabled={shop.pending}
                  aria-busy={shop.pending}
                  onClick={() => shop.pay(methods[0]!.id)}
                >
                  <span>{shop.pending ? CART.pending : CART.checkout}</span>
                  {shop.pending ? null : <span className="gym-btn-figure">{formatGbp(total)}</span>}
                </button>
                <p className="gym-payby">{CART.payBy(methods[0]!.label)}</p>
              </>
            ) : methods.length > 1 ? (
              <div className="gym-pay-list">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="gym-btn gym-btn-hazard gym-btn-block"
                    disabled={shop.pending}
                    aria-busy={shop.pending}
                    onClick={() => shop.pay(m.id)}
                  >
                    {shop.pending ? CART.pending : CART.payWith(m.label)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * The Lab Kit, offered in the cart: its name, its parts and its price, all
 * from the view. The checkout takes at most one kit per vial
 * (AddOnView.perVial), so at the limit the button says so and stays put.
 * Anything sold beside the packs that has no such limit is a plain add.
 */
function KitOffer({ addOn }: { addOn: AddOnView }) {
  const cart = useCart();
  const [status, setStatus] = useState("");
  const { priced } = cart;
  const maxed = addOn.perVial && priced.kits >= priced.vials;
  const price = formatGbp(addOn.priceMinor);
  return (
    <section aria-labelledby={`kit-${addOn.sku}`} className="gym-kit">
      <div className="gym-kit-row">
        <h3 id={`kit-${addOn.sku}`} className="gym-kit-name">
          {addOn.name}
        </h3>
        <p className="gym-kit-price">{price}</p>
      </div>
      {addOn.contents ? <p className="gym-kit-contents">{addOn.contents}.</p> : null}
      <p className="gym-kit-lead">
        {CART.kit.lead}
        {addOn.perVial ? ` ${CART.kit.limit}` : ""}
      </p>
      <button
        type="button"
        className="gym-btn gym-btn-ghost"
        disabled={maxed}
        onClick={() => {
          cart.add(addOn.sku);
          setStatus(CART.kit.added(addOn.name));
        }}
      >
        {CART.kit.add(addOn.name)}
        <span className="sr-only">, {price}</span>
      </button>
      {maxed ? <p className="gym-kit-note">{CART.kit.maxed}</p> : null}
      <p role="status" className="sr-only">
        {status}
      </p>
    </section>
  );
}
