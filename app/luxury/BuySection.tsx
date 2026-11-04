"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { PackPicker } from "@/components/commerce/PackPicker";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor } from "@/lib/commerce/view";
import { CapsDiagram } from "@/brands/luxury/components/CapsDiagram";
import { BUY } from "@/brands/luxury/copy/home";

/**
 * The first hour of the order of the day: choose a size, say how many
 * boxes, add them to the order, pay. It sits on the lacquer, inside the
 * home page's timetable (app/luxury/page.tsx), which holds the #buy anchor
 * an unfinished payment returns to.
 *
 * Every figure comes from the storefront view the root layout gave the
 * basket; the checkout prices the order again from the catalogue, and its
 * answer is shown as it stands. Prices are set small and never as a saving
 * or a per-vial figure: this brand does not sell on price. While the view
 * lists no way to pay there is no payment button at all.
 *
 * The gift option sits in the order, above payment, while the view offers
 * one (flags.giftNote): ticked, it opens a note field, and the note goes with
 * the order to be printed on the packing slip. Unticked, nothing is sent,
 * whatever was typed.
 */
export function BuySection() {
  const cart = useCart();
  const { storefront, priced } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [sku, setSku] = useState<string | null>(storefront.packs.find((p) => p.available)?.sku ?? null);
  const [qty, setQty] = useState(1);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [gift, setGift] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const orderId = useId();
  const deliveryName = useId();
  const giftId = useId();

  // Ticking the gift option takes the customer straight to the note.
  useEffect(() => {
    if (gift) noteRef.current?.focus();
  }, [gift]);

  const empty = priced.items.length === 0;
  const delivery = deliveryQuote(storefront, priced.goodsMinor);
  // The first option offered unless the buyer picked another that is still
  // offered at this basket's value.
  const chosen = delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const addOns = storefront.addOns.filter((a) => a.available);
  const onRequest = storefront.packs.some((p) => !p.available);
  const message = error ?? priced.problem;
  const methods = storefront.payment.methods;
  const totalMinor = priced.goodsMinor + (chosen?.priceMinor ?? 0);
  const giftNote = storefront.flags.giftNote && gift ? note : undefined;
  const pay = (method: string) => checkout({ deliveryOption: chosen?.option.id, method, giftNote });
  const nameOf = (pack: { label: string; vials: number }) => pack.label || BUY.vials(pack.vials);
  const price = (minor: number) => (minor === 0 ? BUY.included : formatGbp(minor));

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const pack = storefront.packs.find((p) => p.sku === sku);
          if (!pack) return;
          cart.add(pack.sku, qty);
          setAdded(BUY.added(nameOf(pack), qty));
        }}
      >
        <PackPicker
          packs={storefront.packs}
          value={sku}
          onChange={(next) => {
            setSku(next);
            setAdded(null);
          }}
          legend={BUY.legend}
          classNames={{ list: "rx-sizes", option: "rx-size" }}
          renderPack={(pack, { disabled }) => (
            <>
              <CapsDiagram vials={pack.vials} className="rx-size__caps" />
              <span className="rx-size__name">{nameOf(pack)}</span>
              {pack.label ? <span className="rx-size__vials">{BUY.vials(pack.vials)}</span> : null}
              <span className="rx-size__price">{disabled ? BUY.onRequest : formatGbp(pack.priceMinor)}</span>
            </>
          )}
        />
        {onRequest ? (
          <p className="rx-note">
            {BUY.requestNote}{" "}
            <Link href="/contact" className="rx-link">
              {BUY.requestLink}
            </Link>
            .
          </p>
        ) : null}

        <div className="rx-add">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            max={storefront.limits.maxLineQty}
            label={BUY.boxes}
            classNames={{
              root: "rx-stepper",
              label: "rx-stepper__label",
              input: "rx-stepper__input",
              button: "rx-stepper__btn",
            }}
          />
          <button type="submit" className="rx-btn" disabled={!sku}>
            {BUY.add}
          </button>
        </div>
        <p role="status" className="rx-status">
          {added ?? ""}
        </p>
      </form>

      {addOns.length > 0 ? (
        <section aria-label={BUY.addOnsHeading} className="rx-addons">
          <ul>
            {addOns.map((a) => (
              <li key={a.sku}>
                <span>
                  <span className="block">
                    {a.name}, {formatGbp(a.priceMinor)}
                  </span>
                  {a.contents ? <span className="rx-note block">{a.contents}</span> : null}
                </span>
                <button type="button" className="rx-btn rx-btn--line" onClick={() => cart.add(a.sku)}>
                  {BUY.addOnAdd}
                  <span className="sr-only"> {a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={orderId} className="rx-order rx-frame">
        <h4 id={orderId} className="rx-order__heading">
          {BUY.orderHeading}
        </h4>

        {!cart.hydrated ? null : empty ? (
          <p className="rx-order__empty">{BUY.empty}</p>
        ) : (
          <>
            <ul className="rx-lines">
              {priced.items.map((item) => {
                const name = item.kind === "pack" ? nameOf(item.pack) : item.addOn.name;
                return (
                  <li key={item.sku} className="rx-line">
                    <span className="rx-line__name">
                      {name}
                      {item.kind === "pack" && item.pack.label ? (
                        <span className="rx-line__vials">{BUY.vials(item.pack.vials)}</span>
                      ) : null}
                    </span>
                    <span className="rx-line__price">{formatGbp(item.lineMinor)}</span>
                    <span className="rx-line__controls">
                      <QuantityStepper
                        value={item.qty}
                        onChange={(n) => cart.set(item.sku, n)}
                        max={storefront.limits.maxLineQty}
                        label={BUY.lineBoxes(name)}
                        classNames={{ root: "rx-stepper", input: "rx-stepper__input", button: "rx-stepper__btn" }}
                      />
                      <button type="button" className="rx-link rx-line__remove" onClick={() => cart.remove(item.sku)}>
                        {BUY.remove}
                        <span className="sr-only"> {name}</span>
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="rx-sum">
              {delivery.length === 1 && chosen ? (
                <div>
                  <dt>
                    {BUY.delivery}
                    <span className="rx-sum__detail">
                      {chosen.option.label}, {chosen.option.carrier}
                    </span>
                  </dt>
                  <dd>{price(chosen.priceMinor)}</dd>
                </div>
              ) : null}
              <div className="rx-sum__total">
                <dt>{BUY.total}</dt>
                <dd>{formatGbp(totalMinor)}</dd>
              </div>
            </dl>

            {delivery.length > 1 ? (
              <fieldset className="rx-choice">
                <legend>{BUY.delivery}</legend>
                {delivery.map(({ option, priceMinor }) => (
                  <label key={option.id}>
                    <span>
                      <input
                        type="radio"
                        name={deliveryName}
                        value={option.id}
                        checked={chosen?.option.id === option.id}
                        onChange={() => setDeliveryId(option.id)}
                      />
                      {option.label}, {option.detail}
                    </span>
                    <span>{price(priceMinor)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {shortfall !== null && shortfall > 0 ? <p className="rx-note">{BUY.shortfall(formatGbp(shortfall))}</p> : null}

            {storefront.flags.giftNote ? (
              <div className="rx-gift">
                <label className="rx-gift__option">
                  <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} />
                  {BUY.giftOption}
                </label>
                {gift ? (
                  <div className="rx-gift__note">
                    <label htmlFor={`${giftId}-note`} className="rx-gift__label">
                      {BUY.giftNoteLabel}
                    </label>
                    <textarea
                      ref={noteRef}
                      id={`${giftId}-note`}
                      className="rx-gift__field"
                      rows={3}
                      value={note}
                      maxLength={storefront.limits.maxGiftNote}
                      onChange={(e) => setNote(e.target.value)}
                      aria-describedby={`${giftId}-hint`}
                    />
                    <p id={`${giftId}-hint`} className="rx-note">
                      {BUY.giftNoteHint(storefront.limits.maxGiftNote)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {message ? (
          <p role="alert" className="alert-error mt-5">
            {message}
          </p>
        ) : null}

        {methods.length === 1 ? (
          <div className="rx-pay">
            <button
              type="button"
              className="rx-btn rx-btn--wide"
              disabled={empty || pending}
              aria-busy={pending}
              onClick={() => pay(methods[0]!.id)}
            >
              {pending ? BUY.paying : BUY.pay}
            </button>
            <p className="rx-note">{BUY.payNote(methods[0]!.label)}</p>
          </div>
        ) : methods.length > 1 ? (
          <div className="rx-pay">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className="rx-btn rx-btn--wide"
                disabled={empty || pending}
                aria-busy={pending}
                onClick={() => pay(m.id)}
              >
                {pending ? BUY.paying : BUY.payWith(m.label)}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
