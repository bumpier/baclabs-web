"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import {
  deliveryQuote,
  formatGbp,
  freeDeliveryShortfallMinor,
  packSavingMinor,
  type PackView,
} from "@/lib/commerce/view";
import { count, MATRIX, onSale, vials } from "@/brands/wholesale/copy/home";
import { ORDER } from "@/brands/wholesale/copy/order";
import {
  basketSavingMinor,
  basketVials,
  cheaperPacks,
  maxQtyFor,
  perVialMinor,
} from "@/brands/wholesale/components/order-math";
import { SHOW_ORDER_EVENT } from "@/brands/wholesale/components/events";
import { quoteMailto } from "@/brands/wholesale/mailbox";

const DESKTOP = "(min-width: 1024px)";

/**
 * The order: a tier price table that is also the quantity matrix, and the
 * order summary beside it.
 *
 * The table lists every pack the catalogue has. A pack sold online takes a
 * typed number of packs (with a step either side) and shows its per-vial
 * price, its pack price, its saving against the base rate and its line
 * total; a pack sold by quote opens an email asking for a quote on that size.
 *
 * The summary is one element in two shapes. On a desktop it sits beside the
 * table and stays in view as the page scrolls. On a phone it is a bottom
 * sheet: a bar along the foot of the screen carries the vials and the total
 * once the order holds any, and opens the full summary over the page. The
 * header's order button opens it too (SHOW_ORDER_EVENT), as does a link to
 * #order.
 *
 * The quantities are the basket's lines (components/commerce/cart.tsx), so
 * a ?buy= link, another tab and a return from an unfinished payment all
 * land here. Every figure is the storefront view's; the checkout prices the
 * order again from the catalogue and its refusal is shown as it stands.
 * While the view lists no way to pay there is no checkout button at all.
 */
export function OrderDesk() {
  const cart = useCart();
  const { storefront: view, priced, lines } = cart;
  const { checkout, pending, error } = useBrandCheckout();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [capped, setCapped] = useState<{ sku: string; max: number } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(true);
  // Motion only answers a change: nothing rolls or scans on load.
  const [live, setLive] = useState(false);
  const seen = useRef<typeof lines | null>(null);
  const ids = {
    caption: useId(),
    notes: useId(),
    summary: useId(),
    delivery: useId(),
    company: useId(),
    vat: useId(),
    hint: useId(),
  };
  const sheetHeading = useRef<HTMLHeadingElement>(null);
  const barButton = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const base = onSale(view)[0];
  const n = basketVials(view, lines);
  const empty = priced.items.length === 0;
  const per = perVialMinor(view, lines);
  const saving = basketSavingMinor(view, lines);
  const better = cheaperPacks(view, lines);
  const atLimit = n >= view.limits.maxVials;
  const delivery = deliveryQuote(view, priced.goodsMinor);
  const chosen =
    delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
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

  useEffect(() => {
    if (!cart.hydrated) return;
    if (seen.current !== null && seen.current !== lines) setLive(true);
    seen.current = lines;
  }, [cart.hydrated, lines]);

  // Phone or desktop: the summary is a sheet below 1024px.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const sheet = !desktop;

  const openSheet = useCallback(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
  }, []);
  const closeSheet = useCallback(() => {
    setOpen(false);
    (returnFocus.current ?? barButton.current)?.focus({ preventScroll: true });
  }, []);

  // The header's button, and a link to #order: the summary, in whichever shape.
  const show = useCallback(() => {
    if (window.matchMedia(DESKTOP).matches) {
      document
        .getElementById("buy")
        ?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      sheetHeading.current?.focus({ preventScroll: true });
    } else openSheet();
  }, [openSheet]);
  useEffect(() => {
    window.addEventListener(SHOW_ORDER_EVENT, show);
    if (window.location.hash === "#order") show();
    return () => window.removeEventListener(SHOW_ORDER_EVENT, show);
  }, [show]);

  // A refusal or a payment that came back unfinished is said in the summary: open it on a phone.
  useEffect(() => {
    if (error && !window.matchMedia(DESKTOP).matches) setOpen(true);
  }, [error]);

  // The open sheet: focus its heading, lock the page behind it, Escape closes it.
  useEffect(() => {
    if (!sheet || !open) return;
    sheetHeading.current?.focus({ preventScroll: true });
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    // A modal sheet: Escape closes it, and Tab wraps inside it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSheet();
        return;
      }
      if (e.key !== "Tab" || !summaryRef.current) return;
      const focusable = [
        ...summaryRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex="-1"]'
        ),
      ].filter((el) => el.offsetParent !== null || el === sheetHeading.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !summaryRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !summaryRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet, open, closeSheet]);
  useEffect(() => {
    if (!sheet) setOpen(false);
  }, [sheet]);

  // The bar takes room at the foot of the page while it shows.
  const bar = cart.hydrated && sheet && n > 0 && !open;
  useEffect(() => {
    document.documentElement.classList.toggle("bk-has-bar", bar);
    return () => document.documentElement.classList.remove("bk-has-bar");
  }, [bar]);

  const setQty = (pack: PackView, typed: number, max: number) => {
    const next = Math.max(0, Math.min(max, typed));
    setCapped(typed > max ? { sku: pack.sku, max } : null);
    cart.set(pack.sku, next);
  };

  return (
    <div className="bk-desk" data-live={live ? "" : undefined}>
      <div className="bk-matrix-wrap">
        <table className="bk-matrix" aria-describedby={ids.notes} role="table">
          <caption id={ids.caption} className="sr-only">
            {MATRIX.caption}
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {MATRIX.pack}
              </th>
              <th scope="col" role="columnheader" className="bk-c-code">
                {MATRIX.code}
              </th>
              <th scope="col" role="columnheader" className="bk-num">
                {MATRIX.perVial}
              </th>
              <th scope="col" role="columnheader" className="bk-num">
                {MATRIX.packPrice}
              </th>
              <th scope="col" role="columnheader" className="bk-c-save">
                {MATRIX.saving}
              </th>
              <th scope="col" role="columnheader" className="bk-c-qty">
                {MATRIX.quantity}
              </th>
              <th scope="col" role="columnheader" className="bk-num bk-c-line">
                {MATRIX.line}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {view.packs.map((pack) => {
              const qty = lines.find((l) => l.sku === pack.sku)?.qty ?? 0;
              const packHead = (
                <th scope="row" role="rowheader" className="bk-c-pack">
                  <span className="bk-pack-n">{count(pack.vials)}</span>{" "}
                  <span className="bk-pack-unit">vials</span>
                  {pack.label ? (
                    <span className="bk-pack-label">{pack.label}</span>
                  ) : null}
                </th>
              );
              const code = (
                <td role="cell" className="bk-c-code">
                  <span
                    className="bk-sku"
                    data-quote={pack.available ? undefined : ""}
                  >
                    {pack.sku}
                  </span>
                </td>
              );
              if (!pack.available) {
                return (
                  <tr key={pack.sku} role="row" data-quote="">
                    {packHead}
                    {code}
                    <td role="cell" colSpan={3} className="bk-c-onrequest">
                      {MATRIX.byQuote}
                    </td>
                    <td role="cell" colSpan={2} className="bk-c-quote">
                      <a
                        href={quoteMailto(pack.vials)}
                        className="bk-btn-outline bk-btn-sm"
                      >
                        {MATRIX.requestQuote}
                        <span className="sr-only">
                          {" "}
                          for {vials(pack.vials)}
                        </span>
                      </a>
                    </td>
                  </tr>
                );
              }
              const packSaving = packSavingMinor(view, pack);
              const max = Math.max(qty, maxQtyFor(view, lines, pack));
              return (
                <tr
                  key={pack.sku}
                  role="row"
                  data-active={qty > 0 ? "" : undefined}
                >
                  {packHead}
                  {code}
                  <td
                    role="cell"
                    className="bk-num bk-c-per"
                    data-label={MATRIX.perVial}
                  >
                    <span className="bk-per">
                      {formatGbp(pack.perVialMinor)}
                    </span>
                  </td>
                  <td
                    role="cell"
                    className="bk-num bk-c-price"
                    data-label={MATRIX.packPrice}
                  >
                    {formatGbp(pack.priceMinor)}
                  </td>
                  <td
                    role="cell"
                    className="bk-c-save"
                    data-label={MATRIX.saving}
                  >
                    {pack.sku === base?.sku ? (
                      <span className="bk-base">{MATRIX.baseRate}</span>
                    ) : packSaving > 0 && base ? (
                      <span
                        className="bk-save"
                        title={`${MATRIX.save(packSaving)} ${MATRIX.saveDetail(base.vials)}`}
                      >
                        {MATRIX.save(packSaving)}
                        <span className="sr-only">
                          {" "}
                          {MATRIX.saveDetail(base.vials)}
                        </span>
                      </span>
                    ) : null}
                  </td>
                  <td role="cell" className="bk-c-qty">
                    <QtyInput
                      value={qty}
                      max={max}
                      label={MATRIX.quantityLabel(pack)}
                      onChange={(typed) => setQty(pack, typed, max)}
                    />
                    {capped?.sku === pack.sku ? (
                      <p className="bk-capped" role="status">
                        {MATRIX.capped(capped.max, pack)}
                      </p>
                    ) : null}
                  </td>
                  <td
                    role="cell"
                    className="bk-num bk-c-line"
                    data-label={MATRIX.line}
                  >
                    {qty > 0 ? (
                      <span className="bk-line-total">
                        {formatGbp(pack.priceMinor * qty)}
                      </span>
                    ) : (
                      <span className="bk-dash" aria-label="None">
                        –
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div id={ids.notes} className="bk-matrix-notes">
          {MATRIX.notes(view).map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>

      {sheet && open ? (
        <div className="bk-scrim" aria-hidden="true" onClick={closeSheet} />
      ) : null}

      <aside
        ref={summaryRef}
        id="order"
        aria-labelledby={ids.summary}
        className="bk-summary"
        data-open={open ? "" : undefined}
        role={sheet && open ? "dialog" : undefined}
        aria-modal={sheet && open ? true : undefined}
        inert={sheet && !open ? true : undefined}
      >
        <div className="bk-summary-head">
          <h2
            id={ids.summary}
            ref={sheetHeading}
            tabIndex={-1}
            className="bk-summary-title"
          >
            {ORDER.heading}
          </h2>
          <span className="bk-summary-count" aria-hidden={!cart.hydrated}>
            <span key={n} className="bk-tick">
              {count(n)}
            </span>{" "}
            {n === 1 ? "vial" : "vials"}
          </span>
          {sheet ? (
            <button
              type="button"
              className="bk-sheet-close"
              onClick={closeSheet}
              aria-label={ORDER.close}
            >
              <svg
                viewBox="0 0 20 20"
                width="20"
                height="20"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M5 5l10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {cart.hydrated ? ORDER.status(n, priced.goodsMinor) : ""}
        </p>

        <div className="bk-summary-body">
          {empty ? (
            <p className="bk-summary-empty">{ORDER.empty}</p>
          ) : (
            <>
              <ul className="bk-lines">
                {priced.items.map((item) => (
                  <li key={item.sku} className="bk-line">
                    <span
                      className="bk-line-scan"
                      key={item.qty}
                      aria-hidden="true"
                    />
                    <span className="bk-line-name">
                      {item.kind === "pack"
                        ? ORDER.line(item.qty, item.pack.vials)
                        : `${item.qty} × ${item.addOn.name}`}
                    </span>
                    <span className="bk-line-amount">
                      {formatGbp(item.lineMinor)}
                    </span>
                    <span className="bk-sku bk-sku-sm">{item.sku}</span>
                    <button
                      type="button"
                      className="bk-line-remove"
                      onClick={() => cart.remove(item.sku)}
                      aria-label={
                        item.kind === "pack"
                          ? ORDER.removeLabel(item.pack.vials)
                          : `${ORDER.remove} ${item.addOn.name}`
                      }
                    >
                      {ORDER.remove}
                    </button>
                  </li>
                ))}
              </ul>

              {better ? (
                <div className="bk-advice">
                  <p>
                    {ORDER.cheaper(
                      n,
                      better.packs
                        .map(({ pack, qty }) => ORDER.line(qty, pack.vials))
                        .join(" and "),
                      better.savesMinor,
                    )}
                  </p>
                  <button
                    type="button"
                    className="bk-btn-outline bk-btn-sm"
                    onClick={() => cart.replace(better.lines)}
                  >
                    {ORDER.switchTo}
                  </button>
                </div>
              ) : null}

              <dl className="bk-figures">
                <div>
                  <dt>{ORDER.vials}</dt>
                  <dd>{count(n)}</dd>
                </div>
                <div>
                  <dt>{ORDER.perVial}</dt>
                  <dd>
                    {per !== null ? (
                      <span key={per} className="bk-tick">
                        {formatGbp(per)}
                      </span>
                    ) : (
                      <span className="sr-only">{ORDER.notSet}</span>
                    )}
                  </dd>
                </div>
                {saving > 0 && base ? (
                  <div className="bk-figure-save">
                    <dt>{ORDER.saving(base.vials)}</dt>
                    <dd>
                      <span key={saving} className="bk-tick">
                        {formatGbp(saving)}
                      </span>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{ORDER.goods}</dt>
                  <dd>{formatGbp(priced.goodsMinor)}</dd>
                </div>
                {delivery.length === 1 && chosen ? (
                  <div>
                    <dt>
                      {ORDER.delivery}
                      <span className="bk-figure-detail">
                        {chosen.option.label} by {chosen.option.carrier}
                      </span>
                    </dt>
                    <dd>
                      {chosen.priceMinor === 0
                        ? ORDER.free
                        : formatGbp(chosen.priceMinor)}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {delivery.length > 1 ? (
                <fieldset className="bk-delivery">
                  <legend>{ORDER.deliveryLegend}</legend>
                  {delivery.map(({ option, priceMinor }) => (
                    <label key={option.id} className="bk-delivery-option">
                      <input
                        type="radio"
                        name={ids.delivery}
                        value={option.id}
                        checked={chosen?.option.id === option.id}
                        onChange={() => setDeliveryId(option.id)}
                      />
                      <span>
                        {option.label}
                        <span className="bk-figure-detail">
                          {option.detail}
                        </span>
                      </span>
                      <span className="bk-num">
                        {priceMinor === 0 ? ORDER.free : formatGbp(priceMinor)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {shortfall !== null ? (
                <p className="bk-summary-note">
                  {formatGbp(shortfall)} more and delivery is free.
                </p>
              ) : null}

              <div className="bk-total">
                <span>{ORDER.total}</span>
                <span key={totalMinor} className="bk-tick bk-total-amount">
                  {formatGbp(totalMinor)}
                </span>
              </div>
            </>
          )}

          {atLimit ? (
            <p className="bk-summary-note">
              {ORDER.atLimit(view.limits.maxVials)} {ORDER.moreThanLimit}{" "}
              <a href={quoteMailto()} className="link">
                {ORDER.quote}
              </a>
              .
            </p>
          ) : null}

          {!empty && business && methods.length > 0 ? (
            <details
              className="bk-business"
              open={company !== "" || vatNumber !== "" ? true : undefined}
            >
              <summary>{ORDER.businessHeading}</summary>
              <div className="bk-business-fields">
                <div>
                  <label htmlFor={ids.company} className="label">
                    {ORDER.company}
                  </label>
                  <input
                    id={ids.company}
                    className="field"
                    value={company}
                    maxLength={100}
                    autoComplete="organization"
                    aria-describedby={ids.hint}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={ids.vat} className="label">
                    {ORDER.vat}
                  </label>
                  <input
                    id={ids.vat}
                    className="field"
                    value={vatNumber}
                    maxLength={30}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={ids.hint}
                    onChange={(e) => setVatNumber(e.target.value)}
                  />
                </div>
                <p id={ids.hint} className="bk-summary-note">
                  {ORDER.businessHint}
                </p>
              </div>
            </details>
          ) : null}

          {message ? (
            <p role="alert" className="alert-error bk-alert">
              {message}
            </p>
          ) : null}

          {methods.length === 1 ? (
            <div className="bk-pay">
              <button
                type="button"
                className="btn-cta bk-btn-pay"
                disabled={empty || pending}
                aria-busy={pending}
                onClick={() => pay(methods[0]!.id)}
              >
                {pending ? ORDER.pending : ORDER.pay}
              </button>
              <p className="bk-summary-note">
                {ORDER.payNote(methods[0]!.label)}
              </p>
            </div>
          ) : methods.length > 1 ? (
            <div className="bk-pay">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="btn-cta bk-btn-pay"
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
            <p className="bk-clear">
              <button
                type="button"
                className="link"
                onClick={() => cart.clear()}
              >
                {ORDER.clear}
              </button>
            </p>
          ) : null}
        </div>
      </aside>

      {bar ? (
        <div className="bk-bar">
          <span className="bk-bar-figures">
            <span className="bk-bar-n">{vials(n)}</span>
            <span className="bk-bar-total">
              {ORDER.barTotal(formatGbp(totalMinor))}
            </span>
          </span>
          <button
            ref={barButton}
            type="button"
            className="btn-cta bk-bar-btn"
            aria-controls="order"
            aria-expanded={false}
            onClick={openSheet}
          >
            {ORDER.view}
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M4.5 12.5 10 7l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A typed count of packs, 0 to `max`, with a step either side. The field
 * keeps what is typed until it is a number; a number past `max` is set to
 * `max` and the row says why (OrderDesk's capped note).
 */
function QtyInput({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (typed: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="bk-qty">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <button
        type="button"
        className="bk-qty-btn"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label={`${label}: one fewer`}
        aria-controls={id}
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 8h10" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className="bk-qty-input"
        value={draft ?? String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(digits);
          if (digits !== "") {
            const typed = Number(digits);
            onChange(typed);
            if (typed > max) setDraft(null);
          }
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          if (draft === "") onChange(0);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(max, value + 1));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(0, value - 1));
          }
        }}
      />
      <button
        type="button"
        className="bk-qty-btn"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`${label}: one more`}
        aria-controls={id}
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
