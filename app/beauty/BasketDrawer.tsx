"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor } from "@/lib/commerce/view";
import { BASKET, packName } from "@/brands/beauty/copy/site";
import { BOX_THUMB, IMAGES } from "@/brands/beauty/copy/images";
import { useBasketDrawer } from "@/brands/beauty/components/basket-drawer";
import { Photo } from "@/brands/beauty/components/Photo";
import { CloseIcon } from "@/brands/beauty/components/icons";

/**
 * The basket, as a drawer from the right edge, rendered once by the root
 * layout and opened from the header, from every "Add to basket", by a
 * reorder link, and by a checkout that comes back unfinished. A native
 * modal <dialog>: focus stays inside it, Esc and the backdrop close it, and
 * focus returns to whatever opened it.
 *
 * Its lines with their counts, how far the basket is from free delivery,
 * the subtotal, the delivery choice and the way to pay. Figures come from
 * the storefront view; the checkout prices the order again from the
 * catalogue and its refusal is shown word for word. While the view lists no
 * way to pay there is no checkout button at all.
 */
export function BasketDrawer() {
  const cart = useCart();
  const { storefront, priced } = cart;
  const drawer = useBasketDrawer();
  const { checkout, pending, error } = useBrandCheckout();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const deliveryName = useId();
  const hashChecked = useRef(false);

  // The drawer follows its state; showModal() is what makes it modal.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (drawer.open && !d.open) d.showModal();
    if (!drawer.open && d.open) d.close();
  }, [drawer.open]);

  // A checkout's refusal, or the reason a payment came back unfinished
  // (useBrandCheckout reads ?payment=): open the drawer so it is seen.
  const { show } = drawer;
  useEffect(() => {
    if (error) show();
  }, [error, show]);

  // Back from the payment page without paying, to /#buy (the provider's
  // cancel address), with the basket still full: open it.
  useEffect(() => {
    if (!cart.hydrated || hashChecked.current) return;
    hashChecked.current = true;
    if (window.location.hash === "#buy" && cart.lines.length > 0) show();
  }, [cart.hydrated, cart.lines.length, show]);

  const empty = priced.items.length === 0;
  const delivery = deliveryQuote(storefront, priced.goodsMinor);
  // The first option offered, unless the buyer picked another that is still
  // offered at this basket's value.
  const chosen = delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
  const freeFrom = storefront.delivery.freeFromMinor;
  const freeOption = storefront.delivery.options.find((o) => o.overThreshold === "free") ?? null;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const progress = freeFrom ? Math.min(1, priced.goodsMinor / freeFrom) : 0;
  const message = error ?? priced.problem;
  const methods = storefront.payment.methods;
  const pay = (method: string) => checkout({ deliveryOption: chosen?.option.id, method });

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      className="bb-drawer no-print"
      onCancel={(e) => {
        e.preventDefault();
        drawer.hide();
      }}
      onClose={() => drawer.hide()}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === dialog.current) drawer.hide();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-5 sm:px-8 sm:pt-7">
          <h2 id={headingId} className="bb-h3">
            {BASKET.heading}
          </h2>
          <button type="button" className="bb-icon-btn -mr-2.5" onClick={() => drawer.hide()}>
            <CloseIcon />
            <span className="sr-only">{BASKET.close}</span>
          </button>
        </div>

        {!empty && freeFrom !== null ? (
          <div className="px-6 pb-5 sm:px-8">
            <p className="bb-small">{shortfall !== null ? BASKET.shortfall(shortfall, freeOption?.label ?? null) : BASKET.freeReached(freeOption?.label ?? null)}</p>
            <div className="bb-meter mt-2.5" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress.toFixed(3)})` }} />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 sm:px-8">
          {!cart.hydrated ? null : empty ? (
            <div className="flex h-full flex-col items-start justify-center pb-16">
              <div className="bb-frame aspect-square w-32">
                <Photo image={IMAGES.box} fill sizes="8rem" alt="" className={BOX_THUMB} />
              </div>
              <p className="bb-h3 mt-6">{BASKET.empty}</p>
              <p className="bb-small mt-2">{BASKET.emptyBody}</p>
              <Link href="/#essentials" className="btn-cta mt-7" onClick={() => drawer.hide()}>
                {BASKET.emptyCta}
              </Link>
            </div>
          ) : (
            <ul className="space-y-2 pb-4">
              {priced.items.map((item) => {
                const name = item.kind === "pack" ? packName(item.pack.vials) : item.addOn.name;
                const fresh = drawer.open && item.sku === drawer.added;
                return (
                  <li
                    key={fresh ? `${item.sku}-${drawer.nonce}` : item.sku}
                    className="bb-line -mx-3 grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-x-4 rounded-[1.25rem] p-3"
                    data-new={fresh || undefined}
                  >
                    <div className="bb-frame row-span-2 aspect-square w-[4.5rem] rounded-[1rem]">
                      <Photo image={IMAGES.box} fill sizes="4.5rem" alt="" className={BOX_THUMB} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[1.25rem] leading-tight">{name}</p>
                      {item.kind === "pack" ? <p className="bb-fine mt-0.5">{BASKET.contents(item.pack.vials)}</p> : null}
                    </div>
                    <p className="bb-price text-right text-[1.25rem]">{formatGbp(item.lineMinor)}</p>
                    <div className="col-span-2 mt-2.5 flex items-center justify-between gap-3">
                      <QuantityStepper
                        value={item.qty}
                        onChange={(n) => cart.set(item.sku, n)}
                        max={storefront.limits.maxLineQty}
                        label={BASKET.quantityOf(name)}
                        classNames={{ root: "bb-qty bb-qty-sm", button: "bb-step", input: "bb-count" }}
                      />
                      <button type="button" className="bb-link text-[0.9375rem] text-ink-soft" onClick={() => cart.remove(item.sku)}>
                        {BASKET.remove}
                        <span className="sr-only"> {name}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!empty || message ? (
          <div className="border-t border-line bg-surface px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
            {!empty ? (
              <>
                {delivery.length > 0 ? (
                  <fieldset>
                    <legend className="mb-2.5 text-[0.9375rem] font-semibold">{BASKET.delivery}</legend>
                    <div className="space-y-2">
                      {delivery.map(({ option, priceMinor }) => {
                        const checked = chosen?.option.id === option.id;
                        return (
                          <label key={option.id} className="bb-choice" data-checked={checked || undefined}>
                            <input
                              type="radio"
                              name={deliveryName}
                              value={option.id}
                              checked={checked}
                              onChange={() => setDeliveryId(option.id)}
                              className="sr-only"
                            />
                            <span className="bb-dot mt-1 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold leading-snug">{option.label}</span>
                              <span className="bb-fine block">{option.detail}</span>
                            </span>
                            <span className="shrink-0 font-semibold">{priceMinor === 0 ? BASKET.free : formatGbp(priceMinor)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : null}
                <dl className="mt-5 flex items-baseline justify-between gap-4">
                  <dt className="font-semibold">{BASKET.subtotal}</dt>
                  <dd className="bb-price text-[1.75rem]">{formatGbp(priced.goodsMinor)}</dd>
                </dl>
              </>
            ) : null}

            {message ? (
              <p role="alert" className="alert-error mt-4">
                {message}
              </p>
            ) : null}

            {methods.length === 1 ? (
              <>
                <button
                  type="button"
                  className="btn-cta mt-5 w-full"
                  disabled={empty || pending}
                  aria-busy={pending}
                  onClick={() => pay(methods[0]!.id)}
                >
                  {pending ? BASKET.pending : BASKET.checkout}
                </button>
                <p className="bb-fine mt-3 text-center">
                  {BASKET.payBy(methods[0]!.label)} {BASKET.sent}
                </p>
              </>
            ) : methods.length > 1 ? (
              <div className="mt-5 space-y-3">
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
                <p className="bb-fine text-center">{BASKET.sent}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
