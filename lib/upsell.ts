import {
  BUNDLES,
  DELIVERY,
  SINGLE_BUNDLE,
  TOP_UP_MAX_VIALS,
  UPSELL,
  deliveryMinorFor,
  formatMinor,
  freeDeliveryName,
  perVialMinor,
  priceOrder,
  remainingForFreeDeliveryMinor,
  shipsFree,
  type Bundle,
} from "@/config/funnel";

/**
 * The step up offered before checkout: from what the customer has chosen to
 * the next pack on the ladder, priced with delivery the way Stripe will
 * charge it (deliveryMinorFor, the function the session calls), so the
 * difference the offer states is the difference they would pay.
 *
 * Three kinds, tried in this order:
 *  - "same-for-less": several packs that add up to a pack we sell (2 × 10
 *    vials), when that one pack costs less. Offered first, because steering
 *    someone past a cheaper way to the same vials is not an upsell.
 *  - "top-up": the same packs plus one or two loose vials, when that takes
 *    the order to free delivery and no pack holding as many vials is cheaper
 *    to pay for. The 10-pack is £5.01 short; one £5.99 vial clears it.
 *  - "step-up": the smallest pack holding more vials than the order. It can
 *    cost less too (4 single vials against the 5-pack); the copy says so.
 *
 * An order that already carries loose vials gets no offer: the customer has
 * just acted on one.
 */

export interface PricedChoice {
  bundle: Bundle;
  /** Packs of `bundle`. 1 on the offered side, except for a top-up. */
  quantity: number;
  /** Loose vials on top of the packs. Only a top-up offer has any. */
  extraVials: number;
  /** Vials in all, loose ones included. */
  vials: number;
  goodsMinor: number;
  /** Delivery this order would be charged, 0 when it ships free. */
  deliveryMinor: number;
  payableMinor: number;
}

export interface Upsell {
  kind: "same-for-less" | "top-up" | "step-up";
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

function priced(bundle: Bundle, quantity: number, extraVials = 0): PricedChoice | null {
  const order = priceOrder(bundle, quantity, extraVials);
  if (!order) return null;
  const deliveryMinor = deliveryMinorFor(order.goodsMinor);
  return {
    bundle,
    quantity,
    extraVials,
    vials: order.vials,
    goodsMinor: order.goodsMinor,
    deliveryMinor,
    payableMinor: order.goodsMinor + deliveryMinor,
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

/**
 * Loose vials that take this order to free delivery: the fewest that do,
 * up to TOP_UP_MAX_VIALS, and only when no single pack holding at least as
 * many vials is as cheap or cheaper to pay for. Null otherwise.
 */
function topUpFor(from: PricedChoice): PricedChoice | null {
  if (from.bundle.id === SINGLE_BUNDLE.id || DELIVERY.mode !== "threshold" || shipsFree(from.goodsMinor)) return null;
  for (let k = 1; k <= TOP_UP_MAX_VIALS; k++) {
    const to = priced(from.bundle, from.quantity, k);
    if (!to || !shipsFree(to.goodsMinor)) continue;
    const packBeatsIt = BUNDLES.some((b) => {
      const pack = priced(b, 1);
      return pack !== null && b.vials >= to.vials && pack.payableMinor <= to.payableMinor;
    });
    return packBeatsIt ? null : to;
  }
  return null;
}

/** The one offer for this selection, or null (switched off, topped up, or nothing bigger). */
export function upsellFor(bundle: Bundle, quantity: number, extraVials = 0): Upsell | null {
  if (!UPSELL.enabled || extraVials > 0) return null;
  const from = priced(bundle, quantity);
  if (!from) return null;

  if (quantity > 1) {
    const same = BUNDLES.find((b) => b.vials === from.vials);
    const to = same ? priced(same, 1) : null;
    if (to && to.payableMinor < from.payableMinor) return offer("same-for-less", from, to);
  }

  const topUp = topUpFor(from);
  if (topUp) return offer("top-up", from, topUp);

  const next = BUNDLES.filter((b) => b.vials > from.vials).sort((a, b) => a.vials - b.vials)[0];
  const to = next ? priced(next, 1) : null;
  return to ? offer("step-up", from, to) : null;
}

/** What one vial costs in this choice, in pence. */
export function perVialOf(c: PricedChoice): number {
  return c.quantity === 1 && c.extraVials === 0 ? perVialMinor(c.bundle) : Math.round(c.goodsMinor / c.vials);
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

  if (u.kind === "top-up") {
    const k = to.extraVials;
    const added = formatMinor(to.goodsMinor - from.goodsMinor);
    const net =
      u.extraMinor > 0
        ? `That's ${extra} more than you'd pay now, delivery included.`
        : u.extraMinor === 0
          ? "That's no more than you'd pay now, delivery included."
          : `That's ${saving} less than you'd pay now, delivery included.`;
    return {
      heading: `You're ${formatMinor(u.toFreeMinor)} away from free ${free}`,
      body: `Add ${vials(k)} for ${added} and your order ships free. ${net}`,
      line: `Add ${vials(k)} for ${added} and ${free} is free${u.extraMinor > 0 ? `: ${extra} more, delivery included` : ""}.`,
      accept: `Add ${vials(k)}`,
      decline,
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
