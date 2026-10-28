"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DELIVERY,
  LAB_KIT,
  PRODUCT,
  SINGLE_BUNDLE,
  STARTER_KIT,
  UPSELL,
  formatMinor,
  freeDeliveryName,
  shipsFree,
} from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import {
  kitOfferCopy,
  kitOfferFor,
  perVialOf,
  upsellCopy,
  upsellFor,
  type KitOffer,
  type PricedChoice,
  type Upsell,
} from "@/lib/upsell";
import { useFunnel } from "@/components/funnel/FunnelState";
import { useCheckout, useResetOnRestore } from "@/components/funnel/buy/useCheckout";
import { FreeDeliveryMeter } from "@/components/funnel/buy/FreeDeliveryMeter";

/**
 * The checkout buttons, with one offer in between: a click shows the offer
 * for the current selection (lib/upsell.ts), and both of the dialog's
 * buttons go straight on to Stripe, so taking the offer or not costs the
 * customer no extra step. Closing it goes back to the page.
 *
 * Lab Kits first (Liam, 28 Oct 2026): an order without them is offered a
 * kit for every vial, or the Starter Kit for a lone vial. The pack step-up
 * is the offer only when there is no kit offer to make (kits switched off,
 * or this selection was already offered them), and stays as the line above
 * the button either way.
 *
 * Shown at most once per selection per visit (sessionStorage), so going
 * back from Stripe and paying never meets it twice. It never switches the
 * buy box: the offered pack is paid for directly (checkoutPack).
 */

const SEEN_KEY = "baclab-upsell-seen";

function seenKey(u: Upsell | KitOffer): string {
  const key = `${u.from.bundle.id}x${u.from.quantity}+${u.from.extraVials}`;
  return "kitUnitMinor" in u ? `kit:${key}` : key;
}

function wasSeen(key: string): boolean {
  try {
    return (sessionStorage.getItem(SEEN_KEY) ?? "").split(",").includes(key);
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    const seen = (sessionStorage.getItem(SEEN_KEY) ?? "").split(",").filter(Boolean);
    sessionStorage.setItem(SEEN_KEY, [...seen, key].join(","));
  } catch {
    // Private mode: it may show again, which is all that is lost.
  }
}

function offerEvent(u: Upsell) {
  // What the offer adds: the loose vials for a top-up, the pack otherwise.
  const topUp = u.kind === "top-up";
  const item = topUp ? SINGLE_BUNDLE : u.to.bundle;
  return {
    currency: "GBP",
    value: u.to.goodsMinor / 100,
    bundleId: item.id,
    vials: u.to.vials,
    contentIds: [u.from.bundle.id, item.id],
    items: [
      {
        item_id: item.sku,
        item_name: `${PRODUCT.name} ${item.vials} × ${PRODUCT.size}`,
        price: item.priceMinor / 100,
        quantity: topUp ? u.to.extraVials : 1,
      },
    ],
  };
}

function kitOfferEvent(o: KitOffer) {
  const item = o.starter
    ? { item_id: STARTER_KIT.sku, item_name: STARTER_KIT.name, price: STARTER_KIT.priceMinor / 100, quantity: 1 }
    : { item_id: LAB_KIT.sku, item_name: LAB_KIT.name, price: o.kitUnitMinor / 100, quantity: o.to.kits };
  return {
    currency: "GBP",
    value: o.to.goodsMinor / 100,
    bundleId: item.item_id,
    vials: o.to.vials,
    contentIds: [o.from.bundle.id, item.item_id],
    items: [item],
  };
}

/**
 * useCheckout with the offer in front of it. `start` is the button's
 * onClick; render `dialog` anywhere, it goes to <body>.
 */
export function useUpsellCheckout() {
  const { bundle, quantity, extraVials, kits } = useFunnel();
  const { checkout, checkoutPack, pending, error } = useCheckout();
  const [offer, setOffer] = useState<Upsell | null>(null);
  const [kitOffer, setKitOffer] = useState<KitOffer | null>(null);
  const [taken, setTaken] = useState<"accept" | "decline" | null>(null);
  useResetOnRestore(
    useCallback(() => {
      setOffer(null);
      setKitOffer(null);
      setTaken(null);
    }, [])
  );

  function start() {
    const k = UPSELL.popup ? kitOfferFor(bundle, quantity, extraVials, kits) : null;
    if (k && !wasSeen(seenKey(k))) {
      markSeen(seenKey(k));
      setKitOffer(k);
      setTaken(null);
      trackEvent("upsell_view", kitOfferEvent(k));
      return;
    }
    // No offer with Lab Kits chosen (upsellFor), so accept and decline below
    // never have kits to carry.
    const u = UPSELL.popup ? upsellFor(bundle, quantity, extraVials, kits) : null;
    if (u && !wasSeen(seenKey(u))) {
      markSeen(seenKey(u));
      setOffer(u);
      setTaken(null);
      trackEvent("upsell_view", offerEvent(u));
      return;
    }
    void checkout();
  }

  function accept() {
    if (kitOffer) {
      setTaken("accept");
      trackEvent("upsell_accept", kitOfferEvent(kitOffer));
      const { to } = kitOffer;
      void checkoutPack(to.bundle, to.quantity, to.extraVials, to.kits);
      return;
    }
    if (!offer) return;
    setTaken("accept");
    trackEvent("upsell_accept", offerEvent(offer));
    void checkoutPack(offer.to.bundle, offer.to.quantity, offer.to.extraVials);
  }

  function decline() {
    if (kitOffer) {
      setTaken("decline");
      trackEvent("upsell_decline", kitOfferEvent(kitOffer));
      const { from } = kitOffer;
      void checkoutPack(from.bundle, from.quantity, from.extraVials);
      return;
    }
    if (!offer) return;
    setTaken("decline");
    trackEvent("upsell_decline", offerEvent(offer));
    void checkoutPack(offer.from.bundle, offer.from.quantity, offer.from.extraVials);
  }

  const close = () => {
    setOffer(null);
    setKitOffer(null);
  };
  const dialog = kitOffer ? (
    <KitOfferDialog
      offer={kitOffer}
      pending={pending}
      taken={taken}
      error={error}
      onAccept={accept}
      onDecline={decline}
      onClose={close}
    />
  ) : offer ? (
    <UpsellDialog
      offer={offer}
      pending={pending}
      taken={taken}
      error={error}
      onAccept={accept}
      onDecline={decline}
      onClose={close}
    />
  ) : null;

  // While the dialog is open its own buttons carry the state and the error.
  const open = offer !== null || kitOffer !== null;
  return { start, pending: pending && !open, error: open ? null : error, dialog };
}

interface OfferProps {
  pending: boolean;
  taken: "accept" | "decline" | null;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

/**
 * The modal both offers sit in: the heading, the close button, Escape and a
 * click on the backdrop to go back to the page (never while redirecting),
 * then the offer, the two buttons and the line under them.
 */
function OfferDialog({
  heading,
  accept,
  decline,
  pending,
  taken,
  error,
  onAccept,
  onDecline,
  onClose,
  children,
}: OfferProps & {
  heading: string;
  accept: { label: string; payableMinor: number };
  decline: { label: string; payableMinor: number };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, [mounted]);

  if (!mounted) return null;

  function close() {
    if (!pending) onClose();
  }

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="no-print m-auto w-[calc(100%-2rem)] max-w-md rounded-panel border border-line bg-surface p-0 text-ink shadow-panel backdrop:bg-abyss/60"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-brand-tint hover:text-ink"
        >
          &times;
        </button>
        <h2 id={headingId} className="pr-8 font-display text-2xl font-bold text-ink">
          {/* Non-breaking hyphens: "next-" / "day" split badly at phone width. */}
          {heading.replace(/-/g, "\u2011")}
        </h2>

        {children}

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onAccept} disabled={pending} aria-busy={pending && taken === "accept"} className="btn-cta">
            {pending && taken === "accept" ? (
              "Redirecting…"
            ) : (
              <>
                {accept.label}
                <span aria-hidden="true">&middot;</span>
                <span className="tabular">{formatMinor(accept.payableMinor)}</span>
              </>
            )}
          </button>
          <button type="button" onClick={onDecline} disabled={pending} aria-busy={pending && taken === "decline"} className="btn-quiet w-full">
            {pending && taken === "decline" ? (
              "Redirecting…"
            ) : (
              <>
                {decline.label}
                <span aria-hidden="true">&middot;</span>
                <span className="tabular">{formatMinor(decline.payableMinor)}</span>
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-ink-soft">Either way, you pay on Stripe&rsquo;s secure page next.</p>

        {error ? (
          <p role="alert" className="alert-error mt-3">
            {error}
          </p>
        ) : null}
      </div>
    </dialog>,
    document.body
  );
}

function UpsellDialog({ offer, ...props }: OfferProps & { offer: Upsell }) {
  const copy = upsellCopy(offer);
  return (
    <OfferDialog
      heading={copy.heading}
      accept={{ label: copy.accept, payableMinor: offer.to.payableMinor }}
      decline={{ label: copy.decline, payableMinor: offer.from.payableMinor }}
      {...props}
    >
      <p className="mt-3 text-ink-soft">{copy.body}</p>

      {offer.unlocksFreeDelivery ? <FreeDeliveryMeter goodsMinor={offer.from.goodsMinor} scale className="mt-5" /> : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <ChoiceCard title="You chose" choice={offer.from} />
        <ChoiceCard
          title={offer.kind === "same-for-less" ? "One pack" : offer.kind === "top-up" ? "Free delivery" : "Upgrade"}
          choice={offer.to}
          offered
        />
      </div>
    </OfferDialog>
  );
}

/**
 * The Lab Kit offer: what the kits are and cost, the pieces they hold for
 * this order, multiplied out, and the free delivery they unlock if they do.
 */
function KitOfferDialog({ offer, ...props }: OfferProps & { offer: KitOffer }) {
  const copy = kitOfferCopy(offer);
  const n = offer.to.kits;
  return (
    <OfferDialog
      heading={copy.heading}
      accept={{ label: copy.accept, payableMinor: offer.to.payableMinor }}
      decline={{ label: copy.decline, payableMinor: offer.from.payableMinor }}
      {...props}
    >
      <p className="mt-3 text-ink-soft">{copy.body}</p>

      {offer.unlocksFreeDelivery ? <FreeDeliveryMeter goodsMinor={offer.from.goodsMinor} scale className="mt-5" /> : null}

      <div className="mt-5 rounded-control border border-brand bg-cta-tint px-4 py-3 ring-1 ring-brand">
        <p className="flex items-baseline justify-between gap-3 text-base font-semibold text-ink">
          <span>
            {offer.starter ? (
              STARTER_KIT.name
            ) : (
              <>
                <span className="tabular">{n}</span> × {LAB_KIT.name}
              </>
            )}
          </span>
          <span className="tabular">
            {offer.starter ? formatMinor(offer.to.goodsMinor) : `+${formatMinor(offer.kitsMinor)}`}
          </span>
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-soft">
          {offer.starter ? (
            <li>
              <span className="tabular">1</span> × {PRODUCT.size}
            </li>
          ) : null}
          {LAB_KIT.parts.map((part) => (
            <li key={part.sku}>
              <span className="tabular">{part.perKit * n}</span> × {part.name.toLowerCase()}s
            </li>
          ))}
        </ul>
      </div>
    </OfferDialog>
  );
}

/** One side of the comparison: the pack, a vial's price, and the total with delivery. */
function ChoiceCard({ title, choice, offered = false }: { title: string; choice: PricedChoice; offered?: boolean }) {
  const free = DELIVERY.mode !== "unknown" && shipsFree(choice.goodsMinor);
  return (
    <div
      className={[
        "rounded-control border px-3 py-3",
        offered ? "border-brand bg-cta-tint ring-1 ring-brand" : "border-line bg-surface",
      ].join(" ")}
    >
      <p className={offered ? "text-xs font-semibold text-brand-deep" : "text-xs text-ink-soft"}>{title}</p>
      <p className="mt-1 text-base font-semibold text-ink">
        {choice.extraVials > 0 ? (
          <>
            <span className="tabular">{choice.bundle.vials * choice.quantity}</span> +{" "}
            <span className="tabular">{choice.extraVials}</span> vials
          </>
        ) : choice.quantity > 1 ? (
          <>
            <span className="tabular">{choice.quantity}</span> × <span className="tabular">{choice.bundle.vials}</span>{" "}
            {choice.bundle.vials === 1 ? "vial" : "vials"}
          </>
        ) : (
          <>
            <span className="tabular">{choice.vials}</span> {choice.vials === 1 ? "vial" : "vials"}
          </>
        )}
      </p>
      {/* A top-up's per-vial figure (£40.98 over 11) reads worse than the
          pack's own, when what it buys is the free delivery. Say what it is. */}
      <p className="text-xs text-ink-soft">
        {choice.extraVials > 0 ? (
          <>
            {choice.bundle.vials}-vial pack + {choice.extraVials} single
          </>
        ) : (
          <>
            <span className="tabular">{formatMinor(perVialOf(choice))}</span> a vial
          </>
        )}
      </p>
      <p className="mt-2 tabular text-lg font-semibold text-ink">{formatMinor(choice.payableMinor)}</p>
      <p className="text-xs text-ink-soft">
        {DELIVERY.mode === "unknown"
          ? "+ delivery"
          : free
            ? `Free ${freeDeliveryName()}`
            : `incl. ${formatMinor(choice.deliveryMinor)} delivery`}
      </p>
    </div>
  );
}
