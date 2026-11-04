/**
 * How a brand's legal pages describe each way to pay (BrandProfile.payment,
 * read by lib/commerce/legal.ts): one set of words per provider, the same on
 * every brand that takes it. Brand-neutral and method-specific: no brand's
 * name, no card wording, nothing a provider does not do for us.
 *
 * A brand uses a provider's words only together with listing the provider
 * in its paymentProviders, on an account of its own.
 */
import type { BrandPayment } from "./types";

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
