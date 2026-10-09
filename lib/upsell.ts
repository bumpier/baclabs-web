import {
  BUNDLES,
  DELIVERY,
  UPSELL,
  deliveryMinorFor,
  formatMinor,
  freeDeliveryName,
  perVialMinor,
  remainingForFreeDeliveryMinor,
  shipsFree,
  totalMinor,
  type Bundle,
} from "@/config/funnel";

/**
 * The step up offered before checkout: from what the customer has chosen to
 * the next pack on the ladder, priced with delivery the way Stripe will
 * charge it (deliveryMinorFor, the function the session calls), so the
 * difference the offer states is the difference they would pay.
 *
 * Two kinds:
 *  - "same-for-less": several packs that add up to a pack we sell (2 × 10
 *    vials), when that one pack costs less. Offered first, because steering
 *    someone past a cheaper way to the same vials is not an upsell.
 *  - "step-up": the smallest pack holding more vials than the order. It can
 *    cost less too (4 single vials against the 5-pack); the copy says so.
 */

export interface PricedChoice {
  bundle: Bundle;
  /** Packs of `bundle`. Always 1 on the offered side. */
  quantity: number;
  vials: number;
  goodsMinor: number;
  /** Delivery this order would be charged, 0 when it ships free. */
  deliveryMinor: number;
  payableMinor: number;
}

export interface Upsell {
  kind: "same-for-less" | "step-up";
  from: PricedChoice;
  to: PricedChoice;
  /** to.payable less from.payable. Negative when the offer costs less. */
  extraMinor: number;
  extraVials: number;
  /** The offer ships free and the current order does not. */
  unlocksFreeDelivery: boolean;
  /** The current order ships free and the offer does not (only a cheaper offer can). */
  losesFreeDelivery: boolean;
  /** Still to add before the current order ships free. 0 when it does. */
  toFreeMinor: number;
}

function priced(bundle: Bundle, quantity: number): PricedChoice {
  const goodsMinor = totalMinor(bundle, quantity);
  const deliveryMinor = deliveryMinorFor(goodsMinor);
  return {
    bundle,
    quantity,
    vials: bundle.vials * quantity,
    goodsMinor,
    deliveryMinor,
    payableMinor: goodsMinor + deliveryMinor,
  };
}

function offer(kind: Upsell["kind"], from: PricedChoice, to: PricedChoice): Upsell {
  return {
    kind,
    from,
    to,
    extraMinor: to.payableMinor - from.payableMinor,
    extraVials: to.vials - from.vials,
    unlocksFreeDelivery: !shipsFree(from.goodsMinor) && shipsFree(to.goodsMinor),
    losesFreeDelivery: shipsFree(from.goodsMinor) && !shipsFree(to.goodsMinor),
    toFreeMinor: remainingForFreeDeliveryMinor(from.goodsMinor),
  };
}

/** The one offer for this selection, or null (switched off, or nothing bigger). */
export function upsellFor(bundle: Bundle, quantity: number): Upsell | null {
  if (!UPSELL.enabled) return null;
  const from = priced(bundle, quantity);

  if (quantity > 1) {
    const same = BUNDLES.find((b) => b.vials === from.vials);
    if (same) {
      const to = priced(same, 1);
      if (to.payableMinor < from.payableMinor) return offer("same-for-less", from, to);
    }
  }

  const next = BUNDLES.filter((b) => b.vials > from.vials).sort((a, b) => a.vials - b.vials)[0];
  return next ? offer("step-up", from, priced(next, 1)) : null;
}

/** What one vial costs in this choice, in pence. */
export function perVialOf(c: PricedChoice): number {
  return c.quantity === 1 ? perVialMinor(c.bundle) : Math.round(c.goodsMinor / c.vials);
}

const vials = (n: number) => `${n} ${n === 1 ? "vial" : "vials"}`;
const moreVials = (n: number) => `${n} more ${n === 1 ? "vial" : "vials"}`;

/**
 * The words for an offer: the dialog's heading and sentence, the short line
 * under the pack choice, and the two buttons. Free delivery is only ever
 * mentioned when shipsFree() says so, for the order it is said about.
 */
export function upsellCopy(u: Upsell): {
  heading: string;
  body: string;
  line: string;
  accept: string;
  decline: string;
} {
  const { from, to } = u;
  const free = freeDeliveryName();
  const saving = formatMinor(-u.extraMinor);
  const extra = formatMinor(u.extraMinor);
  const perNow = formatMinor(perVialOf(from));
  const perThen = formatMinor(perVialMinor(to.bundle));
  const accept = `Make it ${vials(to.vials)}`;
  const decline = `Keep ${vials(from.vials)}`;
  // A cheaper offer can fall below the free-delivery threshold. The saving
  // already counts that delivery; the customer must also be told about it.
  const deliveryCaveat = u.losesFreeDelivery
    ? ` That includes ${formatMinor(to.deliveryMinor)} delivery: your order ships free now, the ${to.vials}-vial pack doesn't.`
    : "";

  if (u.kind === "same-for-less") {
    return {
      heading: `Same ${vials(to.vials)}, ${saving} less`,
      body: `One ${to.vials}-vial pack holds the same ${vials(to.vials)} as ${from.quantity} × ${vials(from.bundle.vials)}, and costs ${saving} less.${deliveryCaveat}`,
      line: `The same ${vials(to.vials)} cost ${saving} less as one ${to.vials}-vial pack.`,
      accept: `Switch to one ${to.vials}-vial pack`,
      decline: `Keep ${from.quantity} packs`,
    };
  }

  if (u.extraMinor <= 0) {
    const less = u.extraMinor === 0 ? "the same" : `${saving} less`;
    return {
      heading: `${vials(to.vials)} cost less than ${from.vials}`,
      body: `The ${to.vials}-vial pack costs ${less} than your ${vials(from.vials)}, with ${moreVials(u.extraVials)}.${deliveryCaveat}`,
      line: `${vials(to.vials)} cost ${less} than ${from.vials}.`,
      accept,
      decline,
    };
  }

  if (u.unlocksFreeDelivery) {
    return {
      heading: `You're ${formatMinor(u.toFreeMinor)} away from free ${free}`,
      body: `The ${to.vials}-vial pack ships free. That's ${moreVials(u.extraVials)} for ${extra} more than you'd pay now, delivery included: ${perThen} a vial instead of ${perNow}.`,
      line: `Free ${free} with ${to.vials} vials: ${u.extraVials} more for ${extra} more, delivery included.`,
      accept,
      decline,
    };
  }

  // The delivery the current order already pays covers the bigger pack too.
  const cost = `${moreVials(u.extraVials)} cost${u.extraVials === 1 ? "s" : ""} ${extra}: ${perThen} a vial instead of ${perNow}.`;
  const paying = from.deliveryMinor > 0 && to.deliveryMinor === from.deliveryMinor;
  const freeBoth = DELIVERY.mode !== "unknown" && shipsFree(from.goodsMinor);
  return {
    heading: `Make it ${vials(to.vials)} for ${extra} more`,
    body: paying
      ? `You're paying ${formatMinor(from.deliveryMinor)} delivery either way, so ${cost}`
      : `${cost}${freeBoth ? ` Free ${free} either way.` : ""}`,
    line: `${moreVials(u.extraVials)} for ${extra} more, ${perThen} a vial.`,
    accept,
    decline,
  };
}
