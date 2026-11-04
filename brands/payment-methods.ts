/**
 * How a brand's legal pages describe each way to pay (BrandProfile.payment,
 * read by lib/commerce/legal.ts): one set of words per provider, the same on
 * every brand that takes it. Brand-neutral and method-specific: no brand's
 * name, no provider's words on a brand that does not take it, nothing a
 * provider does not do for us.
 *
 * A brand uses a provider's words only together with listing the provider
 * in its paymentProviders: STRIPE_PAYMENT with "stripe", PAYPAL_PAYMENT with
 * "paypal" on an account of the brand's own.
 */
import type { BrandPayment } from "./types";

/**
 * Stripe: card, Apple Pay and Google Pay on Stripe's own hosted checkout
 * page, on BacLab's Stripe account. The substance is BacLab's own pages'
 * (app/(baclab)/(store)/terms, returns and privacy), which describe the same
 * account, in brand-neutral words:
 *  - terms: paid on Stripe's page; the card details never reach us; the
 *    bank may authenticate (the clause already says a declined payment
 *    completes no order);
 *  - returns: refunds go back through Stripe to the card, and usually show
 *    within 5 to 10 working days, depending on the bank;
 *  - privacy: Stripe Payments Europe, Ltd. processes the payment and is a
 *    separate controller for the payment data it collects, under
 *    stripe.com/gb/privacy, and sets its own cookies on its own page.
 * Stripe's Privacy Policy (last updated 28 Apr 2026, read 4 Nov 2026) says
 * Stripe is a controller for its own purposes, fraud prevention among
 * them, and a processor where it processes a payment for the business, and
 * that the Stripe entity responsible "might vary" by jurisdiction; it names
 * none for the UK on that page. The entity and "separate controller" are
 * BacLab's notice's wording, kept so the sites on one account say the same.
 */
export const STRIPE_PAYMENT: BrandPayment = {
  methods: [
    {
      id: "stripe",
      label: "card, Apple Pay or Google Pay",
      terms:
        "you pay on Stripe’s own hosted checkout page. Your card details are entered there and never reach us, and your bank may apply its own authentication step.",
      refunds:
        "we refund through Stripe, to the card you paid with (for Apple Pay or Google Pay, the card behind it). Refunds usually appear on your statement within 5 to 10 working days, depending on your bank.",
    },
  ],
  processors: [
    {
      name: "Stripe Payments Europe, Ltd.",
      purpose: "processing card, Apple Pay and Google Pay payments and refunds",
      privacyUrl: "https://stripe.com/gb/privacy",
      separateController: true,
      note: "If you pay by card, Apple Pay or Google Pay, you pay on Stripe’s own checkout page. Stripe sets its own cookies there, including for fraud prevention, under Stripe’s own privacy policy, not this site’s.",
    },
  ],
};

/**
 * PayPal. Who PayPal is for a UK buyer, read from PayPal's own pages on
 * 4 Nov 2026 (both last updated 12 Oct 2026):
 *  - User Agreement: "the contract between you and PayPal UK Ltd" (76 Upper
 *    Ground, London SE1 9PZ; company no. 14741686; FCA FRN 994790):
 *    https://www.paypal.com/uk/legalhub/paypal/useragreement-full
 *  - Privacy Statement: "The data controller ... is the PayPal entity
 *    established in the country ... where you reside", PayPal UK Ltd for the
 *    UK, and what it shares with merchants "is subject to the Partners' and
 *    Merchants' own privacy policies":
 *    https://www.paypal.com/uk/legalhub/paypal/privacy-full
 * So PayPal decides for itself what it does with the payment data it
 * collects (the buyer's own PayPal account, fraud checks, its regulatory
 * duties): a controller in its own right, not our processor. The statement
 * names PayPal UK Ltd the controller without the word "separate"; calling
 * it a separate controller is our reading of that, for the privacy notice.
 */
export const PAYPAL_PAYMENT: BrandPayment = {
  methods: [
    {
      id: "paypal",
      label: "PayPal",
      terms: "you approve the payment on PayPal’s own pages, and we take it as soon as you have approved it.",
      refunds:
        "we refund through PayPal, to the PayPal account you paid from. How it reaches your balance or the source you funded the payment from follows PayPal’s own terms.",
    },
  ],
  processors: [
    {
      name: "PayPal UK Ltd",
      purpose: "taking payment by PayPal and making refunds",
      privacyUrl: "https://www.paypal.com/uk/legalhub/paypal/privacy-full",
      separateController: true,
      note: "If you pay by PayPal, you approve the payment on PayPal’s own pages. Those pages set PayPal’s own cookies under PayPal’s own notice, not this site’s.",
    },
  ],
};
