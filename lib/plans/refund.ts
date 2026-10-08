/**
 * What a cancelled plan refunds (spec, "Cancelling"):
 *   amount paid − boxes sent × (box price + box delivery)
 *               − the bonus pack's price once it has gone out
 * floored at 0. The deduction stops anyone buying a year, keeping the bonus
 * and refunding the rest. The admin records the figure; the Stripe refund
 * itself is made by hand (there is no refund webhook).
 */
export interface RefundInput {
  /** Plan.paidMinor: what was actually charged for the plan. */
  paidMinor: number;
  boxesSent: number;
  boxPriceMinor: number;
  boxDeliveryMinor: number;
  /** Which box carries the bonus pack; 0 = no bonus. */
  bonusBox: number;
  bonusValueMinor: number;
}

export function refundBreakdown(p: RefundInput): {
  paidMinor: number;
  boxesMinor: number;
  bonusSent: boolean;
  bonusMinor: number;
  refundMinor: number;
} {
  const boxesMinor = p.boxesSent * (p.boxPriceMinor + p.boxDeliveryMinor);
  const bonusSent = p.bonusBox > 0 && p.boxesSent >= p.bonusBox;
  const bonusMinor = bonusSent ? p.bonusValueMinor : 0;
  return { paidMinor: p.paidMinor, boxesMinor, bonusSent, bonusMinor, refundMinor: Math.max(0, p.paidMinor - boxesMinor - bonusMinor) };
}

export function planRefundMinor(p: RefundInput): number {
  return refundBreakdown(p).refundMinor;
}
