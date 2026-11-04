"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor, packSavingMinor } from "@/lib/commerce/view";
import { count, onSale, PRICE_LIST, vials } from "@/brands/wholesale/copy/home";
import { ORDER } from "@/brands/wholesale/copy/order";
import {
  basketSavingMinor,
  basketVials,
  cheaperPacks,
  maxQtyFor,
  perVialMinor,
} from "@/brands/wholesale/components/order-math";

const QUOTE_HREF = "/quote";

const STEPPER = {
  root: "wh-stepper",
  input: "wh-stepper-input",
  button: "wh-stepper-button",
};

/**
 * The order desk: the price list is the order form. Every pack the
 * catalogue lists is a row, with its code, its price a vial and its price;
 * the packs on sale take a quantity in their last column, and the packs
 * sold by quote are hatched through and link to the quote form instead.
 * Beside it (below it on a phone) the order label totals what is set: the
 * vials, the price a vial and the saving, the delivery, the total, and the
 * company name and VAT number the trade checkout asks for.
 *
 * The quantities are the basket's lines (components/commerce/cart.tsx), so
 * a ?buy= reorder link, another tab and a return from an unfinished payment
 * all land here. Every figure is the storefront view's; the checkout prices
 * the order again from the catalogue and its refusal is shown as it stands.
 * While the view lists no way to pay there is no checkout button at all.
 *
 * On a phone the label sits under the price list, out of sight of the
 * steppers, so once the order holds vials a slim bar at the foot of the
 * screen carries its three figures and a link down to it, until the label
 * itself scrolls into view.
 */
export function BuySection() {
  const cart = useCart();
  const { storefront: view, priced, lines } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const captionId = useId();
  const notesId = useId();
  const orderId = useId();
  const deliveryName = useId();
  const companyId = useId();
  const vatId = useId();
  const hintId = useId();
  const labelRef = useRef<HTMLElement>(null);
  // The label is still further down the page: not on screen and not yet
  // scrolled past (past it, the bar would only cover the footer).
  const [labelAhead, setLabelAhead] = useState(false);

  useEffect(() => {
    const el = labelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry) setLabelAhead(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const base = onSale(view)[0];
  const n = basketVials(view, lines);
  const empty = priced.items.length === 0;
  const per = perVialMinor(view, lines);
  const saving = basketSavingMinor(view, lines);
  const better = cheaperPacks(view, lines);
  const atLimit = n >= view.limits.maxVials;

  const delivery = deliveryQuote(view, priced.goodsMinor);
  // The first option offered unless the buyer picked another that is still
  // offered at this basket's value.
  const chosen = delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
  const shortfall = freeDeliveryShortfallMinor(view, priced.goodsMinor);
  const totalMinor = priced.goodsMinor + (chosen?.priceMinor ?? 0);
  const message = error ?? priced.problem;
  const methods = view.payment.methods;
  const business = view.flags.businessDetails;
  const pay = (method: string) =>
    checkout({
      deliveryOption: chosen?.option.id,
      method,
      ...(business ? { business: { company, vatNumber } } : {}),
    });

  return (
    <section id="buy" aria-labelledby={captionId} className="wh-desk">
      <div className="wh-sheet wh-pricelist-sheet">
        <table className="wh-table wh-pricelist" aria-describedby={notesId}>
          <caption id={captionId} className="wh-caption">
            <span className="wh-caption-inner">
              <span className="wh-caption-title">{PRICE_LIST.caption}</span>
              <span className="wh-caption-detail">{PRICE_LIST.captionDetail}</span>
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">{PRICE_LIST.pack}</th>
              <th scope="col" className="wh-code">
                {PRICE_LIST.code}
              </th>
              <th scope="col" className="wh-num">
                {PRICE_LIST.perVial}
              </th>
              <th scope="col" className="wh-num">
                {PRICE_LIST.packPrice}
              </th>
              <th scope="col" className="wh-qty-head">
                {PRICE_LIST.quantity}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.packs.map((pack) => {
              const qty = lines.find((l) => l.sku === pack.sku)?.qty ?? 0;
              const packHeader = (
                <th scope="row" className="wh-pack">
                  <span className="wh-pack-n">{count(pack.vials)}</span>
                  <span className="wh-pack-unit"> vials</span>
                  {pack.label ? <span className="wh-pack-label">{pack.label}</span> : null}
                </th>
              );
              if (!pack.available) {
                return (
                  <tr key={pack.sku} data-quote="">
                    {packHeader}
                    <td className="wh-code">{pack.sku}</td>
                    <td colSpan={2} className="wh-quote-cell">
                      {PRICE_LIST.byQuote}
                    </td>
                    <td className="wh-qty">
                      <Link href={`${QUOTE_HREF}?pack=${pack.vials}`} className="wh-quote-link">
                        {PRICE_LIST.requestQuote}
                        <span className="sr-only"> for {vials(pack.vials)}</span>
                      </Link>
                    </td>
                  </tr>
                );
              }
              const packSaving = packSavingMinor(view, pack);
              return (
                <tr key={pack.sku} data-active={qty > 0 ? "" : undefined}>
                  {packHeader}
                  <td className="wh-code">{pack.sku}</td>
                  <td className="wh-num wh-pervial">{formatGbp(pack.perVialMinor)}</td>
                  <td className="wh-num">
                    <span className="wh-price">{formatGbp(pack.priceMinor)}</span>
                    {pack.sku === base?.sku ? (
                      <span className="wh-cell-note">{PRICE_LIST.baseRate}</span>
                    ) : packSaving > 0 ? (
                      <span className="wh-cell-save">{PRICE_LIST.save(packSaving)}</span>
                    ) : null}
                  </td>
                  <td className="wh-qty">
                    <QuantityStepper
                      value={qty}
                      onChange={(next) => cart.set(pack.sku, next)}
                      min={0}
                      max={Math.max(qty, maxQtyFor(view, lines, pack))}
                      label={PRICE_LIST.quantityLabel(pack)}
                      classNames={STEPPER}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div id={notesId} className="wh-table-notes">
          {PRICE_LIST.notes(view).map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>

      <section ref={labelRef} id="order" aria-labelledby={orderId} className="wh-label scroll-mt-4">
        <h2 id={orderId} className="wh-label-head">
          {ORDER.heading}
        </h2>
        <p className="sr-only" aria-live="polite">
          {cart.hydrated ? ORDER.status(n, priced.goodsMinor) : ""}
        </p>

        <dl className="wh-fields">
          <div className="wh-field wh-field-vials">
            <dt>{ORDER.vials}</dt>
            <dd>
              <span key={n} className="wh-tick">
                {count(n)}
              </span>
            </dd>
          </div>
          <div className="wh-field">
            <dt>{ORDER.perVial}</dt>
            <dd>
              {per !== null ? (
                <span key={per} className="wh-tick">
                  {formatGbp(per)}
                </span>
              ) : (
                <>
                  <span aria-hidden="true">–</span>
                  <span className="sr-only">{ORDER.notSet}</span>
                </>
              )}
            </dd>
          </div>
          {saving > 0 && base ? (
            <div className="wh-field wh-field-wide wh-field-save">
              <dt>{ORDER.saving(base.vials)}</dt>
              <dd>
                <span key={saving} className="wh-tick">
                  {formatGbp(saving)}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="wh-label-body">
          {empty ? (
            <p className="wh-label-empty">{ORDER.empty}</p>
          ) : (
            <>
              <table className="wh-lines">
                <caption className="sr-only">{ORDER.heading}</caption>
                <tbody>
                  {priced.items.map((item) => (
                    <tr key={item.sku}>
                      <th scope="row">
                        {item.kind === "pack" ? ORDER.line(item.qty, item.pack.vials) : `${item.qty} × ${item.addOn.name}`}
                        <span className="wh-line-code">{item.sku}</span>
                      </th>
                      <td>{formatGbp(item.lineMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {better ? (
                <div className="wh-notice">
                  <p>
                    {ORDER.cheaper(
                      n,
                      better.packs.map(({ pack, qty }) => ORDER.line(qty, pack.vials)).join(" and "),
                      better.savesMinor
                    )}
                  </p>
                  <button type="button" className="btn-secondary wh-btn-small" onClick={() => cart.replace(better.lines)}>
                    {ORDER.switchTo}
                  </button>
                </div>
              ) : null}

              <dl className="wh-totals">
                <div>
                  <dt>{ORDER.goods}</dt>
                  <dd>{formatGbp(priced.goodsMinor)}</dd>
                </div>
                {delivery.length === 1 && chosen ? (
                  <div>
                    <dt>
                      {ORDER.delivery}
                      <span className="wh-totals-detail">
                        {chosen.option.label}, {chosen.option.detail}
                      </span>
                    </dt>
                    <dd>{chosen.priceMinor === 0 ? ORDER.free : formatGbp(chosen.priceMinor)}</dd>
                  </div>
                ) : null}
              </dl>

              {delivery.length > 1 ? (
                <fieldset className="wh-delivery">
                  <legend>{ORDER.deliveryLegend}</legend>
                  {delivery.map(({ option, priceMinor }) => (
                    <label key={option.id} className="wh-delivery-option">
                      <input
                        type="radio"
                        name={deliveryName}
                        value={option.id}
                        checked={chosen?.option.id === option.id}
                        onChange={() => setDeliveryId(option.id)}
                      />
                      <span>
                        {option.label}
                        <span className="wh-totals-detail">{option.detail}</span>
                      </span>
                      <span className="wh-num">{priceMinor === 0 ? ORDER.free : formatGbp(priceMinor)}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {shortfall !== null ? (
                <p className="wh-label-note">{formatGbp(shortfall)} more and delivery is free.</p>
              ) : null}

              <dl className="wh-totals wh-totals-grand">
                <div>
                  <dt>{ORDER.total}</dt>
                  <dd>
                    <span key={totalMinor} className="wh-tick">
                      {formatGbp(totalMinor)}
                    </span>
                  </dd>
                </div>
              </dl>
            </>
          )}

          {atLimit ? (
            <p className="wh-label-note">
              {ORDER.atLimit(view.limits.maxVials)} {ORDER.moreThanLimit}{" "}
              <Link href={QUOTE_HREF} className="link">
                {ORDER.quote}
              </Link>
              .
            </p>
          ) : null}

          {!empty && business && methods.length > 0 ? (
            <div className="wh-business">
              <div>
                <label htmlFor={companyId} className="label">
                  {ORDER.company}
                </label>
                <input
                  id={companyId}
                  className="field"
                  value={company}
                  maxLength={100}
                  autoComplete="organization"
                  aria-describedby={hintId}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor={vatId} className="label">
                  {ORDER.vat}
                </label>
                <input
                  id={vatId}
                  className="field"
                  value={vatNumber}
                  maxLength={30}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={hintId}
                  onChange={(e) => setVatNumber(e.target.value)}
                />
              </div>
              <p id={hintId} className="wh-label-note">
                {ORDER.businessHint}
              </p>
            </div>
          ) : null}

          {message ? (
            <p role="alert" className="alert-error wh-alert">
              {message}
            </p>
          ) : null}

          {methods.length === 1 ? (
            <div className="wh-pay">
              <button
                type="button"
                className="btn-cta wh-btn-pay"
                disabled={empty || pending}
                aria-busy={pending}
                onClick={() => pay(methods[0]!.id)}
              >
                {pending ? ORDER.pending : ORDER.pay}
              </button>
              <p className="wh-label-note">{ORDER.payNote(methods[0]!.label)}</p>
            </div>
          ) : methods.length > 1 ? (
            <div className="wh-pay">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="btn-cta wh-btn-pay"
                  disabled={empty || pending}
                  aria-busy={pending}
                  onClick={() => pay(m.id)}
                >
                  {pending ? ORDER.pending : ORDER.payBy(m.label)}
                </button>
              ))}
            </div>
          ) : null}

          {!empty ? (
            <p className="wh-clear">
              <button type="button" className="link" onClick={() => cart.clear()}>
                {ORDER.clear}
              </button>
            </p>
          ) : null}
        </div>
      </section>

      {cart.hydrated && n > 0 && labelAhead ? (
        <a href="#order" className="wh-summary-bar">
          <span className="wh-summary-figures">
            <span>
              <span className="wh-summary-n">{count(n)}</span> {ORDER.vials.toLowerCase()}
            </span>
            {per !== null ? <span>{ORDER.perVialShort(formatGbp(per))}</span> : null}
            <span className="wh-summary-total">{formatGbp(totalMinor)}</span>
          </span>
          <span className="wh-summary-go">{ORDER.review}</span>
        </a>
      ) : null}
    </section>
  );
}
