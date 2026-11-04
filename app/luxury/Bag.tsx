"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { useCart } from "@/components/commerce/cart";
import { useBrandCheckout } from "@/components/commerce/useBrandCheckout";
import { QuantityStepper } from "@/components/commerce/QuantityStepper";
import { deliveryQuote, formatGbp, freeDeliveryShortfallMinor, type PackView } from "@/lib/commerce/view";
import { SEAL } from "@/brands/luxury/components/mark-paths";
import { BAG, GIFT, PRODUCT } from "@/brands/luxury/copy/home";
import { NAV } from "@/brands/luxury/copy/site";

/**
 * The bag: a drawer that slides in from the right over every page, the
 * button in the header that opens it (its count is a wax seal, the house's
 * device), and what the two share with the purchase column: whether the
 * drawer is open, the gift option and its note, and a "press" that sets the
 * seal again whenever something is added.
 *
 * The drawer is a modal <dialog>: the page behind is inert, Escape and a
 * click on the shade close it, and focus returns to what opened it. It holds
 * the order as the kit's basket has it (components/commerce/cart.tsx), the
 * delivery the catalogue offers at that value, the gift note and payment,
 * through the kit's checkout contract (useBrandCheckout: POST /api/checkout
 * with the delivery option, the method and the note). The checkout prices
 * the order again; its answer is shown as it stands. A payment that comes
 * back unfinished (?payment=...) opens the drawer on its message.
 *
 * The gift note goes with the order only while the option is ticked, and
 * only on a site whose view offers one (flags.giftNote): unticked, nothing
 * is sent, whatever was typed.
 */

interface BagState {
  open: boolean;
  setOpen: (open: boolean) => void;
  gift: boolean;
  setGift: (gift: boolean) => void;
  note: string;
  setNote: (note: string) => void;
  /** Counts additions, so the seal can be pressed again for each. */
  pressed: number;
  press: () => void;
  drawerId: string;
}

const BagContext = createContext<BagState | null>(null);

export function useBag(): BagState {
  const bag = useContext(BagContext);
  if (!bag) throw new Error("useBag() needs a <BagProvider> above it (app/luxury/layout.tsx)");
  return bag;
}

/** A pack's name in the bag: the catalogue's own ("Ten"), else its count. */
export function sizeName(pack: Pick<PackView, "label" | "vials">): string {
  return pack.label || PRODUCT.vials(pack.vials);
}

export function BagProvider({ thumb, children }: { thumb: ImgHTMLAttributes<HTMLImageElement>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [gift, setGift] = useState(false);
  const [note, setNote] = useState("");
  const [pressed, setPressed] = useState(0);
  const drawerId = useId();
  const press = useCallback(() => setPressed((n) => n + 1), []);
  const value = useMemo(
    () => ({ open, setOpen, gift, setGift, note, setNote, pressed, press, drawerId }),
    [open, gift, note, pressed, press, drawerId]
  );
  return (
    <BagContext.Provider value={value}>
      {children}
      <BagDrawer thumb={thumb} />
    </BagContext.Provider>
  );
}

/** The seal with a number pressed into it: the bag's count. */
function CountSeal({ count }: { count: number }) {
  return (
    <span className="rv-count" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="rv-count__wax" focusable="false">
        <path d={SEAL.edge} />
      </svg>
      <span className="rv-count__n">{count}</span>
    </span>
  );
}

/** The header's "Bag": opens the drawer. Its count shows once the stored basket is read. */
export function BagButton() {
  const { count, hydrated } = useCart();
  const { setOpen, pressed, drawerId } = useBag();
  const shown = hydrated && count > 0;
  return (
    <button
      type="button"
      className="rv-bag-button"
      aria-haspopup="dialog"
      aria-controls={drawerId}
      onClick={() => setOpen(true)}
    >
      {NAV.bag}
      {shown ? (
        <>
          <span key={pressed} className="rv-count-press">
            <CountSeal count={count} />
          </span>
          <span className="sr-only">, {NAV.inBag(count)}</span>
        </>
      ) : null}
    </button>
  );
}

/**
 * The gift option and its note, bound to the bag's state, so the purchase
 * column and the drawer show the same note. Ticking it here moves focus to
 * this note, not to the other copy.
 */
export function GiftFields({ maxLength }: { maxLength: number }) {
  const { gift, setGift, note, setNote } = useBag();
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const ticked = useRef(false);

  useEffect(() => {
    if (gift && ticked.current) field.current?.focus();
    ticked.current = false;
  }, [gift]);

  return (
    <div className="rv-gift">
      <label className="rv-check">
        <input
          type="checkbox"
          checked={gift}
          onChange={(e) => {
            ticked.current = e.target.checked;
            setGift(e.target.checked);
          }}
        />
        {GIFT.option}
      </label>
      {gift ? (
        <div className="rv-gift__note">
          <label htmlFor={`${id}-note`} className="rv-label">
            {GIFT.label}
          </label>
          <textarea
            ref={field}
            id={`${id}-note`}
            className="rv-input rv-gift__field"
            rows={3}
            value={note}
            maxLength={maxLength}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby={`${id}-hint`}
          />
          <p id={`${id}-hint`} className="rv-hint">
            {GIFT.hint(maxLength)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function BagDrawer({ thumb }: { thumb: ImgHTMLAttributes<HTMLImageElement> }) {
  const cart = useCart();
  const { storefront, priced } = cart;
  const { open, setOpen, drawerId, gift, note } = useBag();
  const { checkout, pending, error } = useBrandCheckout();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const deliveryName = useId();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);

  // Open and close the native dialog with the shared state.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // A message from the checkout (or from an unfinished payment) is shown in
  // the drawer, so the drawer opens for it.
  useEffect(() => {
    if (error) setOpen(true);
  }, [error, setOpen]);

  const empty = priced.items.length === 0;
  const delivery = deliveryQuote(storefront, priced.goodsMinor);
  // The first option offered unless the buyer picked another that is still
  // offered at this basket's value.
  const chosen = delivery.find((d) => d.option.id === deliveryId) ?? delivery[0] ?? null;
  const shortfall = freeDeliveryShortfallMinor(storefront, priced.goodsMinor);
  const methods = storefront.payment.methods;
  const message = error ?? priced.problem;
  const totalMinor = priced.goodsMinor + (chosen?.priceMinor ?? 0);
  const giftNote = storefront.flags.giftNote && gift ? note : undefined;
  const pay = (method: string) => checkout({ deliveryOption: chosen?.option.id, method, giftNote });
  const price = (minor: number) => (minor === 0 ? BAG.included : formatGbp(minor));

  return (
    <dialog
      ref={dialog}
      id={drawerId}
      className="rv-drawer"
      aria-labelledby={titleId}
      onClose={() => setOpen(false)}
      onClick={(e) => {
        // A click on the shade lands on the dialog itself, outside its panel.
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="rv-drawer__panel">
        <div className="rv-drawer__head">
          <h2 id={titleId} className="rv-drawer__title">
            {BAG.title}
          </h2>
          <button type="button" className="rv-icon-button" onClick={() => setOpen(false)} aria-label={BAG.close}>
            <CloseIcon />
          </button>
        </div>

        <div className="rv-drawer__body">
          {!cart.hydrated ? null : empty ? (
            <div className="rv-drawer__empty">
              <p>{BAG.empty}</p>
              <Link href="/#buy" className="rv-link" onClick={() => setOpen(false)}>
                {BAG.browse}
              </Link>
            </div>
          ) : (
            <>
              <ul className="rv-lines">
                {priced.items.map((item) => {
                  const name = item.kind === "pack" ? sizeName(item.pack) : item.addOn.name;
                  return (
                    <li key={item.sku} className="rv-line">
                      {/* eslint-disable-next-line @next/next/no-img-element -- next/image's attributes, from the server (components/photo.ts) */}
                      <img {...thumb} alt="" className="rv-line__thumb" />
                      <div className="rv-line__main">
                        <p className="rv-line__name">{name}</p>
                        {item.kind === "pack" && item.pack.label ? (
                          <p className="rv-line__meta">{PRODUCT.vials(item.pack.vials)}</p>
                        ) : null}
                        <div className="rv-line__controls">
                          <QuantityStepper
                            value={item.qty}
                            onChange={(n) => cart.set(item.sku, n)}
                            max={storefront.limits.maxLineQty}
                            label={BAG.lineQty(name)}
                            classNames={{ root: "rv-stepper rv-stepper--small", input: "rv-stepper__input", button: "rv-stepper__btn" }}
                          />
                          <button type="button" className="rv-text-button" onClick={() => cart.remove(item.sku)}>
                            {BAG.remove}
                            <span className="sr-only"> {name}</span>
                          </button>
                        </div>
                      </div>
                      <p className="rv-line__price">{formatGbp(item.lineMinor)}</p>
                    </li>
                  );
                })}
              </ul>
              {storefront.flags.giftNote ? <GiftFields maxLength={storefront.limits.maxGiftNote} /> : null}
            </>
          )}
        </div>

        {cart.hydrated && !empty ? (
          <div className="rv-drawer__foot">
            {delivery.length > 1 ? (
              <fieldset className="rv-choice">
                <legend className="rv-label">{BAG.delivery}</legend>
                {delivery.map(({ option, priceMinor }) => (
                  <label key={option.id} className="rv-choice__row">
                    <span>
                      <input
                        type="radio"
                        name={deliveryName}
                        value={option.id}
                        checked={chosen?.option.id === option.id}
                        onChange={() => setDeliveryId(option.id)}
                      />{" "}
                      {option.label}, {option.detail}
                    </span>
                    <span>{price(priceMinor)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <dl className="rv-sum">
              {delivery.length === 1 && chosen ? (
                <div>
                  <dt>
                    {BAG.delivery}
                    <span className="rv-sum__detail">
                      {chosen.option.label}, {chosen.option.carrier}
                    </span>
                  </dt>
                  <dd>{price(chosen.priceMinor)}</dd>
                </div>
              ) : null}
              <div className="rv-sum__total">
                <dt>{BAG.total}</dt>
                <dd>{formatGbp(totalMinor)}</dd>
              </div>
            </dl>
            {shortfall !== null && shortfall > 0 ? <p className="rv-hint">{BAG.shortfall(formatGbp(shortfall))}</p> : null}
          </div>
        ) : null}

        {message ? (
          <p role="alert" className="rv-alert">
            {message}
          </p>
        ) : null}

        {cart.hydrated && !empty && methods.length > 0 ? (
          <div className="rv-pay">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className="rv-button rv-button--wide"
                disabled={pending}
                aria-busy={pending}
                onClick={() => pay(m.id)}
              >
                {pending ? BAG.paying : methods.length === 1 ? BAG.pay : BAG.payWith(m.label)}
              </button>
            ))}
            {methods.length === 1 ? <p className="rv-hint">{BAG.payNote(methods[0]!.label)}</p> : null}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
