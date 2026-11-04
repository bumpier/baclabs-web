/**
 * The shape every brand payment provider fills in. The brand checkout
 * (lib/commerce/checkout.ts) writes the order first, then hands it to the
 * provider the request chose; the provider answers with the page to send the
 * browser to and its own reference for the payment, which is stored on the
 * order (Order.paymentRef) until the payment is captured.
 *
 * Every provider confirms a payment through fulfillPaidOrder
 * (lib/payments/fulfillment.ts), as BacLab's Stripe and crypto paths do, so
 * a paid order is the same row whoever took the money.
 *
 * Credentials: Stripe is BacLab's own account and key, shared by every
 * brand that lists it (lib/commerce/payments/stripe.ts). Every other
 * provider's are the brand's own and nothing else: never a shared default,
 * never another brand's, never BacLab's. A brand a provider is not
 * configured for is simply not offered it (configured() is false).
 */
import type { BrandPaymentProviderId, BrandProfile } from "@/brands/types";
import type { DeliveryOptionId } from "@/config/funnel";
import type { BrandPricedLine } from "@/lib/order-items";

/** The order a provider is asked to take payment for: already written, pending. */
export interface PaymentOrder {
  /** Our order id: the provider's reference back to us. */
  id: string;
  /** Packs first, then add-ons, priced from the catalogue (lib/commerce/pricing.ts). */
  lines: readonly BrandPricedLine[];
  /** Everything but delivery, in pence. */
  goodsMinor: number;
  /** The delivery the buyer chose on our site, at the price it is charged. */
  delivery: { id: DeliveryOptionId; label: string; priceMinor: number };
}

export interface PaymentContext {
  /** The Host's brand, whose order it is. */
  brand: BrandProfile;
}

export interface CreatedPayment {
  /** Where the browser goes to pay: the provider's own page, https. */
  url: string;
  /** The provider's reference for the payment, kept as Order.paymentRef. */
  ref: string;
}

export interface PaymentAdapter {
  id: BrandPaymentProviderId;
  /** What the buy section calls it when the profile has no words of its own: "PayPal". */
  label: string;
  /**
   * Order.paymentMethod for its orders, as BacLab records the same payment:
   * "card" for Stripe, so a brand's card order reads like BacLab's in the
   * admin, the exports and the owner's alert. Unset: the provider's id.
   */
  paymentMethod?: string;
  /** Whether every credential this brand needs for it is set: its own by its id, or BacLab's for Stripe. */
  configured(brand: Pick<BrandProfile, "id">): boolean;
  /** Start a payment for the order. Throws when the provider refuses; the order then stays unpaid. */
  createPayment(order: PaymentOrder, ctx: PaymentContext): Promise<CreatedPayment>;
}
