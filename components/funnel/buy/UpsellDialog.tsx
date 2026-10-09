"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DELIVERY, PRODUCT, UPSELL, formatMinor, freeDeliveryName, shipsFree } from "@/config/funnel";
import { trackEvent } from "@/lib/analytics";
import { perVialOf, upsellCopy, upsellFor, type PricedChoice, type Upsell } from "@/lib/upsell";
import { useFunnel } from "@/components/funnel/FunnelState";
import { useCheckout, useResetOnRestore } from "@/components/funnel/buy/useCheckout";
import { FreeDeliveryMeter } from "@/components/funnel/buy/FreeDeliveryMeter";

/**
 * The checkout buttons, with the pack step-up in between: a click shows the
 * offer for the current selection (lib/upsell.ts), and both of the dialog's
 * buttons go straight on to Stripe, so taking the offer or not costs the
 * customer no extra step. Closing it goes back to the page.
 *
 * Shown at most once per selection per visit (sessionStorage), so going
 * back from Stripe and paying never meets it twice. It never switches the
 * buy box: the offered pack is paid for directly (checkoutPack).
 */

const SEEN_KEY = "baclab-upsell-seen";

function seenKey(u: Upsell): string {
  return `${u.from.bundle.id}x${u.from.quantity}`;
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
  return {
    currency: "GBP",
    value: u.to.goodsMinor / 100,
    bundleId: u.to.bundle.id,
    vials: u.to.vials,
    contentIds: [u.from.bundle.id, u.to.bundle.id],
    items: [
      {
        item_id: u.to.bundle.sku,
        item_name: `${PRODUCT.name} ${u.to.vials} × ${PRODUCT.size}`,
        price: u.to.bundle.priceMinor / 100,
        quantity: 1,
      },
    ],
  };
}

/**
 * useCheckout with the offer in front of it. `start` is the button's
 * onClick; render `dialog` anywhere, it goes to <body>.
 */
export function useUpsellCheckout() {
  const { bundle, quantity } = useFunnel();
  const { checkout, checkoutPack, pending, error } = useCheckout();
  const [offer, setOffer] = useState<Upsell | null>(null);
  const [taken, setTaken] = useState<"accept" | "decline" | null>(null);
  useResetOnRestore(
    useCallback(() => {
      setOffer(null);
      setTaken(null);
    }, [])
  );

  function start() {
    const u = UPSELL.popup ? upsellFor(bundle, quantity) : null;
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
    if (!offer) return;
    setTaken("accept");
    trackEvent("upsell_accept", offerEvent(offer));
    void checkoutPack(offer.to.bundle, 1);
  }

  function decline() {
    if (!offer) return;
    setTaken("decline");
    trackEvent("upsell_decline", offerEvent(offer));
    void checkoutPack(offer.from.bundle, offer.from.quantity);
  }

  const dialog = offer ? (
    <UpsellDialog
      offer={offer}
      pending={pending}
      taken={taken}
      error={error}
      onAccept={accept}
      onDecline={decline}
      onClose={() => setOffer(null)}
    />
  ) : null;

  // While the dialog is open its own buttons carry the state and the error.
  return { start, pending: pending && !offer, error: offer ? null : error, dialog };
}

function UpsellDialog({
  offer,
  pending,
  taken,
  error,
  onAccept,
  onDecline,
  onClose,
}: {
  offer: Upsell;
  pending: boolean;
  taken: "accept" | "decline" | null;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [mounted, setMounted] = useState(false);
  const copy = upsellCopy(offer);

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
          {copy.heading.replace(/-/g, "\u2011")}
        </h2>
        <p className="mt-3 text-ink-soft">{copy.body}</p>

        {offer.unlocksFreeDelivery ? <FreeDeliveryMeter goodsMinor={offer.from.goodsMinor} scale className="mt-5" /> : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <ChoiceCard title="You chose" choice={offer.from} />
          <ChoiceCard title={offer.kind === "same-for-less" ? "One pack" : "Upgrade"} choice={offer.to} offered />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onAccept} disabled={pending} aria-busy={pending && taken === "accept"} className="btn-cta">
            {pending && taken === "accept" ? (
              "Redirecting…"
            ) : (
              <>
                {copy.accept}
                <span aria-hidden="true">&middot;</span>
                <span className="tabular">{formatMinor(offer.to.payableMinor)}</span>
              </>
            )}
          </button>
          <button type="button" onClick={onDecline} disabled={pending} aria-busy={pending && taken === "decline"} className="btn-quiet w-full">
            {pending && taken === "decline" ? (
              "Redirecting…"
            ) : (
              <>
                {copy.decline}
                <span aria-hidden="true">&middot;</span>
                <span className="tabular">{formatMinor(offer.from.payableMinor)}</span>
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
        {choice.quantity > 1 ? (
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
      <p className="text-xs text-ink-soft">
        <span className="tabular">{formatMinor(perVialOf(choice))}</span> a vial
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
