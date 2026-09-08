import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const whereToBuyUk: Guide = {
  slug: "where-to-buy-bacteriostatic-water-uk",
  title: "Where to buy bacteriostatic water in the UK",
  metaTitle: "Where to Buy Bacteriostatic Water in the UK",
  description:
    "UK pharmacies do not stock bacteriostatic water. Where it is sold, what a listing must show, typical prices per 10 ml vial and how BacLab supplies it.",
  quickAnswer: `UK high-street pharmacies do not generally stock bacteriostatic water, and there is no UK-licensed over-the-counter version to ask for. It is sold online as a laboratory diluent by lab-supply shops, marketplace sellers and specialist single-product sellers such as BacLab. Look for ${FACTS.benzylAlcoholPct} benzyl alcohol on the label, a sealed vial, a printed expiry and UK dispatch.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "Can you buy bacteriostatic water at a UK pharmacy?",
      paragraphs: [
        "Not as a rule. Neither the national pharmacy chains nor independent pharmacies keep bacteriostatic water as a stock line, and a pharmacist will not usually be able to order it in for you. The reason is simple: there is no bacteriostatic water product holding a UK marketing authorisation for over-the-counter sale, so there is nothing on the pharmacy wholesaler lists for the counter to pick from.",
        `The product does exist in the UK, but it lives in a different category. It is supplied as a **laboratory diluent**: sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol (${FACTS.benzylAlcoholMgPerMl}) as a preservative, in a sealed vial, for research and laboratory use. That is how every UK seller lists it, and it is why the search for it starts online rather than on the high street.`,
      ],
    },
    {
      heading: "Is bacteriostatic water available in the UK at all?",
      paragraphs: [
        "Yes. It is readily available, it is not a controlled or restricted substance, and it is not classified as hazardous under the GB CLP Regulation at this concentration. The catch is that it is sold by a small number of online sellers rather than through any shop you can walk into, so where you buy it matters more than for most consumables.",
        "In the United States the equivalent product is a pharmacopoeial item called Bacteriostatic Water for Injection, USP, made by large pharmaceutical manufacturers and sold in 30 ml vials. Some UK resellers import those vials at a higher price. The UK laboratory product is the same composition in a 10 ml vial, and 10 ml is by far the common size sold here.",
      ],
    },
    {
      heading: "Who sells bacteriostatic water in the UK, and what should you expect?",
      paragraphs: [
        "Four kinds of seller come up when you search. They differ less in what is in the vial than in how carefully it is described, how quickly it ships, and whether the listing tells you enough to judge it. Prices below are per 10 ml vial and are typical ranges at the time of writing, not quotations.",
      ],
      table: {
        caption: "Kinds of UK seller of bacteriostatic water compared",
        columns: ["Seller type", "Availability", "Typical price per 10 ml vial", "What to check"],
        rows: [
          [
            "High-street pharmacy",
            "Not stocked; no licensed product to order",
            "Not applicable",
            "Nothing to check. You will be offered sterile water or saline instead, which are different products",
          ],
          [
            "Online marketplaces (Amazon, eBay) via third-party sellers",
            "Listings come and go; stock and seller change often",
            "Roughly £6 to £15, with delivery sometimes added",
            "Who the actual seller is, where it ships from, whether the preservative concentration and expiry are stated, and whether the listing describes it as a laboratory diluent",
          ],
          [
            "Lab-supply and research-chemical shops",
            "Usually an accessory line alongside a main catalogue",
            "Roughly £5 to £12",
            "Fill volume, batch number and expiry on the vial, UK dispatch, and a returns policy for sealed goods",
          ],
          [
            "Specialist single-product sellers",
            "In stock year round; the product is their whole range",
            "Roughly £3 to £6 in packs, more for a single vial",
            "The same label checks as above, plus pack sizes, per-vial price at each size and the delivery threshold",
          ],
        ],
      },
    },
    {
      heading: "What should a good bacteriostatic water listing show?",
      paragraphs: [
        "Whatever the seller, the listing and the vial should between them answer the following before you pay. A seller who cannot tell you these things does not know enough about the product to be selling it.",
      ],
      list: [
        `**Preservative stated as ${FACTS.benzylAlcoholPct} benzyl alcohol**, ideally with the equivalent ${FACTS.benzylAlcoholMgPerMl} figure. If the concentration is missing, or given as a vague "benzyl alcohol" with no number, treat it as unknown.`,
        "**A sealed, tamper-evident vial**: a crimped aluminium collar over the stopper and a flip-off cap, so it is obvious whether the vial has been entered.",
        `**The fill volume** printed on the label, normally ${FACTS.vialMl} ml in the UK, so you know what you are paying per millilitre.`,
        "**A batch or lot number** on the vial. This is how a seller traces a batch if there is ever a problem, and its absence is a warning sign.",
        "**An expiry date** printed on the vial, not just quoted in the listing. Unopened, the printed expiry governs; a typical unopened shelf life is around two years.",
        "**UK dispatch**, stated plainly. Vials posted from outside the UK can take weeks, may attract import charges, and are harder to return.",
        "**A returns policy for sealed goods**. Under UK distance-selling rules an unopened, still-sealed vial can normally be returned; an opened one cannot. A seller should say which is which.",
      ],
    },
    {
      heading: "What should you be wary of when buying bacteriostatic water?",
      paragraphs: [
        "Most of the sellers you will find are perfectly reasonable. A few patterns, though, should make you close the tab.",
      ],
      list: [
        "**Unlabelled or hand-labelled vials.** A product with no manufacturer label, no batch and no volume is not something you can trace or trust.",
        "**Listings that describe it as anything other than a laboratory diluent.** Bacteriostatic water is sold in the UK for research and laboratory use. A listing that attaches it to some other purpose is either misinformed or is describing a different product.",
        "**No expiry stated.** The preservative slows bacterial growth after the stopper is first punctured; it does not make an old or mishandled vial good again. Without an expiry you cannot tell how long it has been on a shelf.",
        "**Photographs that do not match the description.** A 30 ml US vial pictured on a 10 ml listing, or the reverse, suggests a seller who is not looking closely at their own stock.",
        "**No sign of where the seller is.** A UK address, a UK contact email and a UK returns address should all be easy to find.",
        `**Vials that are cloudy, discoloured or contain particles** on arrival. The correct appearance is a ${FACTS.appearance.toLowerCase()}. Anything else goes back to the seller, unopened.`,
      ],
    },
    {
      heading: "Why does buying bacteriostatic water in packs cost less per vial?",
      paragraphs: [
        "Almost every seller charges less per vial as the pack size rises, and the reason is not a marketing trick. A large share of the cost of a single vial is fixed: the outer box, the padding, the postage, the payment fee and the time to pack it are much the same whether the parcel holds one vial or twenty. Spread across a bigger pack, those fixed costs shrink to pennies per vial, and the per-vial price falls with them.",
        `A pack of small sealed vials also suits the way the product is used. Each vial is only opened when it is needed, and the ${FACTS.openedLimit} in-use limit applies to that vial alone, so the rest of the pack stays sealed and keeps to the printed expiry. Ten sealed 10 ml vials give you the same volume as a single large vial without the clock starting on all of it at once.`,
        "The practical rule is to compare per-vial prices at the pack size you will actually use, including delivery, rather than headline single-vial prices. A free-delivery threshold can make a mid-sized pack better value than it first looks.",
      ],
    },
    {
      heading: "How does BacLab supply bacteriostatic water in the UK?",
      paragraphs: [
        `BacLab sells one product and nothing else: bacteriostatic water, sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol (${FACTS.benzylAlcoholMgPerMl}), in a sealed ${FACTS.vialMl} ml vial with a crimped tamper-evident collar and flip-off cap. The label carries the composition, the fill volume, the batch number and the expiry, and states that the product is for research use.`,
        "Vials are sold in packs from 1 to 100, with the per-vial price falling as the pack size rises, and delivery is to UK addresses only. Orders at or above the free-delivery threshold shown on the product page ship free; smaller orders carry a flat delivery charge shown before you pay. Dispatch times are stated at checkout.",
        "Because each vial is sealed for hygiene reasons, the returns policy follows the UK sealed-goods rule: an unopened vial with its seal intact can be returned under your 14-day right to cancel, and anything that arrives damaged is replaced or refunded. The full policy is published on the returns page.",
      ],
    },
  ],
  faq: [
    {
      q: "Can you buy bacteriostatic water at Boots or another UK pharmacy?",
      a: "No. There is no UK-licensed over-the-counter bacteriostatic water for a pharmacy to stock, so neither the large chains nor independent pharmacies carry it. It is sold online as a laboratory diluent.",
    },
    {
      q: "Is bacteriostatic water sold on Amazon or eBay in the UK?",
      a: "Yes, from third-party sellers, and listings change often. Check who the seller actually is, that the vial states 0.9% w/v benzyl alcohol, volume, batch and expiry, and that it ships from the UK.",
    },
    {
      q: "Is bacteriostatic water legal to buy in the UK?",
      a: `Yes. It is a laboratory diluent, not a controlled or restricted substance, and at ${FACTS.benzylAlcoholPct} benzyl alcohol it is not classified as hazardous under the GB CLP Regulation. Any adult can order it from a UK seller.`,
    },
    {
      q: "Can I get bacteriostatic water with next day delivery in the UK?",
      a: "Often, yes. Many UK sellers dispatch the same or next working day by tracked post, but dispatch and transit times vary by seller and by the service you choose, so check what is stated at checkout rather than assuming.",
    },
    {
      q: "How much should a 10 ml vial of bacteriostatic water cost in the UK?",
      a: "Single vials from UK sellers typically sit between about £5 and £15 depending on the seller and delivery. Packs bring the per-vial figure down considerably, so compare prices at the pack size you will actually use.",
    },
    {
      q: "Can I return bacteriostatic water if I change my mind?",
      a: "Under UK distance-selling rules you can normally return an unopened vial with its seal intact within 14 days. Once a vial has been unsealed the sealed-goods exception applies and it cannot be returned, so check the seller's policy before ordering.",
    },
  ],
  related: ["bacteriostatic-water-vial-sizes", "what-is-bacteriostatic-water"],
};
