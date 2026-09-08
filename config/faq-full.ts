import { brand } from "@/config/brand";
import {
  BUNDLES,
  DELIVERY,
  MAX_QUANTITY,
  PRODUCT,
  RETURNS,
  VIAL_ML,
  formatMinor,
  formatMinorShort,
  perVialMinor,
} from "@/config/funnel";
import { FAQ, type FaqItem } from "@/config/faq";
import { FACTS } from "@/content/facts";

/**
 * The full FAQ, for /faq. The home page keeps the short list in config/faq.ts;
 * that list is the first group here, verbatim, so the two can never answer
 * the same question differently. Every figure below is read from config —
 * a price, a threshold or a window typed here by hand would be a second copy
 * waiting to go stale.
 *
 * Nothing here may state or imply a therapeutic use.
 */
export interface FaqGroup {
  id: string;
  title: string;
  items: readonly FaqItem[];
}

const largest = BUNDLES.reduce((a, b) => (b.vials > a.vials ? b : a));
const cheapestPerVial = BUNDLES.reduce((a, b) => (perVialMinor(b) < perVialMinor(a) ? b : a));
const email = brand.contact.email;

function deliveryAnswer(): string {
  switch (DELIVERY.mode) {
    case "free":
      return "UK delivery is free on every order.";
    case "threshold":
      if (DELIVERY.freeFromMinor !== null) {
        const below =
          DELIVERY.priceMinor !== null
            ? ` Below that it is ${formatMinorShort(DELIVERY.priceMinor)}, shown before you pay.`
            : "";
        return `UK delivery is free on orders of ${formatMinorShort(DELIVERY.freeFromMinor)} or more.${below}`;
      }
      return "Delivery is calculated at checkout, before payment.";
    case "flat":
      return DELIVERY.priceMinor !== null
        ? `UK delivery is ${formatMinorShort(DELIVERY.priceMinor)} per order, whatever the size.`
        : "Delivery is calculated at checkout, before payment.";
    default:
      return "Delivery is calculated at checkout, before payment.";
  }
}

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "product",
    title: "The product",
    items: [
      ...FAQ,
      {
        q: "Is bac water the same thing as bacteriostatic water?",
        a: "Yes. Bac water, bacteriostatic mixing water and mixing water are all names for the same thing: sterile water with a bacteriostatic preservative, which here is benzyl alcohol at 0.9% w/v.",
      },
      {
        q: "What does bacteriostatic water look like?",
        a: `${FACTS.appearance}. If a vial is cloudy, discoloured or contains particles it should not be used, whatever the date.`,
      },
      {
        q: "What are the CAS numbers?",
        a: `Water is CAS ${FACTS.casWater}. Benzyl alcohol, the preservative, is CAS ${FACTS.casBenzylAlcohol}. Both are listed in the technical data on the product page and in the safety data sheet.`,
      },
      {
        q: "Is it classified as hazardous?",
        a: `No. ${FACTS.hazardClassification}. Benzyl alcohol is classified as a pure substance, but the mixture falls below the concentration limits for those classifications.`,
      },
      {
        q: "Do you supply a safety data sheet?",
        a: "Yes. The sixteen-section safety data sheet is published on this site and can be printed from the page.",
      },
      {
        q: "Is this a medicine?",
        a: "No. It is sold as a laboratory reagent for research use. It is not a medicine, not a medical device, and not supplied for human or veterinary use. The product disclaimer sets this out in full.",
      },
    ],
  },
  {
    id: "storage",
    title: "Storage and shelf life",
    items: [
      {
        q: "How should an unopened vial be stored?",
        a: PRODUCT.storage
          ? `Store it as printed on the label: ${PRODUCT.storage.replace(/, as printed on the label$/, "")}. Keep it upright, sealed and out of direct light.`
          : "Store it as printed on the label, upright, sealed and out of direct light.",
      },
      {
        q: "How long does it last once opened?",
        a: `${FACTS.openedLimit}. That is the conventional in-use limit for a multi-dose vial, and it applies whether or not the vial is refrigerated. Write the date of first puncture on the vial.`,
      },
      {
        q: "Does it expire unopened?",
        a: "Yes. Each vial carries a printed expiry date, and that date governs an unopened vial. The 28-day in-use limit only starts once the stopper is first punctured.",
      },
      {
        q: "Does it need to be refrigerated?",
        a: PRODUCT.storage
          ? `Follow the label, which states ${PRODUCT.storage.replace(/, as printed on the label$/, "")}. Refrigeration does not extend the in-use limit once the vial is opened.`
          : "Follow the label. Refrigeration does not extend the in-use limit once the vial is opened.",
      },
      {
        q: "Can it be frozen?",
        a: "It is not recommended. Freezing expands the contents against the glass and the stopper seal, and the diluent gains nothing from it. Discard a vial that has been frozen.",
      },
      {
        q: "How do I know a vial should be thrown away?",
        a: "Discard it if it is cloudy, discoloured or contains particles, if the vial is cracked or the seal is loose, if it is past the printed expiry, or if more than 28 days have passed since the stopper was first punctured.",
      },
    ],
  },
  {
    id: "ordering",
    title: "Ordering and payment",
    items: [
      {
        q: "How do I order?",
        a: `Choose a pack size on the product page and go to checkout. You can order up to ${MAX_QUANTITY} of any pack in one order.`,
      },
      {
        q: "How do I pay, and is it secure?",
        a: "Payment is taken by Stripe on Stripe's own hosted checkout page: cards, Apple Pay and Google Pay. Your card details are entered on Stripe's page and are never sent to, or stored by, this site.",
      },
      {
        q: "Do you take payment in cryptocurrency?",
        a: "Where it is switched on, a cryptocurrency option is shown at checkout alongside card payment. Cryptocurrency payments cannot be reversed, so refunds for those orders are returned to a wallet address you confirm in writing.",
      },
      {
        q: "Will I get a receipt?",
        a: "Yes. A confirmation email with the itemised total is sent as soon as payment is received, and a second email when the order is dispatched.",
      },
      {
        q: "Can I change or cancel an order after placing it?",
        a: `Contact us as soon as possible${email ? ` at ${email}` : ""}. If the order has not been dispatched we can usually change or cancel it. Once dispatched, the returns policy applies.`,
      },
      {
        q: "Is VAT included in the price?",
        a: "The price shown is the price you pay. Any VAT treatment is stated on the product page before you reach checkout.",
      },
      {
        q: "Do you sell peptides or anything else?",
        a: `No. ${brand.name} sells one product: ${PRODUCT.name.toLowerCase()} in a ${PRODUCT.size}. We do not stock peptides, research compounds, syringes or other laboratory consumables.`,
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    items: [
      {
        q: "How much is delivery?",
        a: deliveryAnswer(),
      },
      {
        q: "Where do you deliver?",
        a: "To addresses in the United Kingdom. Your delivery address is collected by Stripe at checkout.",
      },
      {
        q: "When will my order be dispatched?",
        a: DELIVERY.dispatchLine || "Dispatch times are shown on the product page and confirmed in your dispatch email.",
      },
      {
        q: "How is it packaged?",
        a: "Each vial is sealed with a rubber stopper under a crimped aluminium collar and a flip-off cap, and packed to protect the glass in transit.",
      },
      {
        q: "What if my parcel has not arrived?",
        a: "Contact us and we will investigate with the carrier. Goods lost in transit remain at our risk, and we will resend or refund at your choice.",
      },
    ],
  },
  {
    id: "wholesale",
    title: "Bulk and wholesale",
    items: [
      {
        q: "Do you sell in bulk?",
        a: `Yes. The packs on the product page run from a single vial to ${largest.vials} vials, and the per-vial price falls with pack size, down to ${formatMinor(perVialMinor(cheapestPerVial))} at ${cheapestPerVial.vials} vials.`,
      },
      {
        q: "Can I order more than the largest pack?",
        a: `You can add up to ${MAX_QUANTITY} of any pack to one order. For anything larger, or for a regular supply, get in touch${email ? ` at ${email}` : ""} and we will quote.`,
      },
      {
        q: "Do you offer trade or laboratory accounts?",
        a: `Not as a separate account type at present. Larger or repeat orders are handled by email${email ? ` at ${email}` : ""}.`,
      },
      {
        q: `Why is a single vial ${formatMinor(PRODUCT.unitPriceMinor)} but the packs cost less per vial?`,
        a: "Picking, packing and posting one order costs the same whether it contains one vial or a hundred, so a larger order carries less of that cost per vial. The saving on each pack is shown next to it.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns and refunds",
    items: [
      {
        q: "Can I return an order?",
        a: `If you are a consumer you have ${RETURNS.windowDays} days from delivery to cancel without giving a reason, provided the vials are unopened with their seals intact. A vial that has been opened or punctured cannot be returned, because it is sealed for hygiene reasons and we cannot verify its sterility once it has left our control.`,
      },
      {
        q: "Who pays for the return postage?",
        a: RETURNS.customerPaysReturn
          ? "You pay the cost of returning unwanted goods. We recommend a tracked service and keeping proof of postage."
          : "We cover the cost of returning goods.",
      },
      {
        q: "What if the vial arrives broken or the order is wrong?",
        a: "Tell us within 14 days of delivery with your order number and photographs of the item and its packaging. We replace or refund damaged, faulty or incorrect items and will not ask you to post back a broken vial.",
      },
      {
        q: "How long does a refund take?",
        a: "Refunds are issued within 14 days of receiving the goods back, or of your cancellation where goods have not been sent. Card refunds go through Stripe and usually show on a statement within 5 to 10 working days.",
      },
    ],
  },
];

/** Every question, flat, for the FAQPage structured data. */
export const FAQ_ALL: readonly FaqItem[] = FAQ_GROUPS.flatMap((g) => g.items);

export { VIAL_ML };
