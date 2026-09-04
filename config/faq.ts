import { BUNDLES, PRODUCT, MAX_QUANTITY, VIAL_ML, formatMinor } from "@/config/funnel";
import { brand } from "@/config/brand";

/** Derived, so the wholesale answer cannot drift from the tier list. */
const LARGEST_BUNDLE = BUNDLES.reduce((a, b) => (b.vials > a.vials ? b : a));

/**
 * FAQ content. ONE source for both the visible accordion and the FAQPage
 * JSON-LD, so the two can never drift apart — Google requires the marked-up
 * Q&A to be visible on the page, and the previous build shipped FAQPage
 * markup with no visible FAQ at all.
 *
 * `todo` marks an answer that is incomplete pending a fact only the operator
 * can supply. An item with a `todo` is rendered with a visible note AND is
 * excluded from the JSON-LD — an unconfirmed answer must never be published
 * to a search engine as fact.
 *
 * Nothing here may state or imply a therapeutic use.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    q: "What is bacteriostatic water?",
    a: "Sterile water containing 0.9% benzyl alcohol as a bacteriostatic preservative. The preservative inhibits the growth of bacteria in the vial, which is what allows a single vial to be entered more than once.",
  },
  {
    q: "How is it different from sterile water?",
    a: "Sterile water contains no preservative. Bacteriostatic water contains 0.9% benzyl alcohol, and that preservative is the whole difference: it is what makes this a multi-dose vial rather than a single-use one.",
  },
  {
    q: "What is the benzyl alcohol for?",
    a: "It is the bacteriostatic preservative. At 0.9% it inhibits bacterial growth inside the vial after it has been entered.",
  },
  // Safety clarification, and a genuine gap in most competing listings: people
  // conflate "bacteriostatic" with "sterilising". True of bacteriostatic water
  // generally, so it needs no fact from this product's own label.
  {
    q: "Does bacteriostatic water sterilise a contaminated vial?",
    a: "No. The benzyl alcohol inhibits the growth of bacteria inside the vial; it does not sterilise the contents, and it does not make a contaminated vial safe to use. It is a preservative, not a steriliser.",
  },
  {
    q: "What is it used for?",
    a: `${PRODUCT.use} It is a diluent, not a product with any activity of its own.`,
  },
  {
    q: "Is it for human use?",
    a: "It is sold as a diluent for laboratory and research purposes.",
  },
  {
    q: "How large is the vial, and how many times can it be used?",
    a: "Each vial holds 10ml and is sealed. How many times it can be drawn from depends entirely on the volume taken each time — a 10ml vial gives ten 1ml draws, or five 2ml draws.",
  },
  {
    q: "How should it be stored, and what is the shelf life?",
    a: `Store the sealed vial as stated on its label. Once it has been entered, the limit is ${PRODUCT.shelfLifeAfterOpening.toLowerCase()}.`,
  },
  {
    q: "How long does it last once opened?",
    a: `${PRODUCT.shelfLifeAfterOpening}. Write the date on the vial the first time you draw from it, and discard it once that period is up. The benzyl alcohol inhibits bacterial growth in the vial between draws — it does not sterilise the contents, so the limit applies however much liquid is left.`,
  },
  {
    q: `How much benzyl alcohol is in a ${VIAL_ML}ml vial?`,
    a: `0.9% w/v, which is 9 mg/mL — so a ${VIAL_ML}ml vial contains ${VIAL_ML * 9} mg of benzyl alcohol in total.`,
  },
  {
    q: "Can I return an order?",
    a: "An unopened vial with its seal intact can be returned within 14 days of delivery for a full refund. A vial that has been opened or unsealed cannot be — it is sealed for hygiene reasons, and regulation 28(3) of the Consumer Contracts Regulations 2013 excludes it. Anything faulty, damaged or not as described is refunded whether or not it was opened. Full terms are on the returns and refunds page.",
  },
  {
    q: "How do I pay, and is it secure?",
    a: "Payment is taken by Stripe on Stripe's own hosted checkout page — cards, Apple Pay and Google Pay. Your card details are entered on Stripe's page and are never sent to, or stored by, this site.",
  },
  {
    q: "Can I get a VAT invoice?",
    a: "Stripe emails a payment receipt for every order automatically.",
  },
  {
    q: "Do you sell in bulk or wholesale?",
    a: `The largest bundle on this page is ${LARGEST_BUNDLE.vials} vials, and you can order up to ${MAX_QUANTITY} of any bundle in a single order. For anything larger, get in touch${brand.contact.email ? ` at ${brand.contact.email}` : ""}.`,
  },
  {
    q: `Why is a single vial ${formatMinor(PRODUCT.unitPriceMinor)} but the packs cost less per vial?`,
    a: "Picking, packing and posting one order costs the same whether it contains one vial or ten, so a larger order carries less of that cost per vial. The saving on each bundle is shown next to it.",
  },
];

/** Published as structured data. */
export const FAQ_PUBLISHABLE = FAQ;
