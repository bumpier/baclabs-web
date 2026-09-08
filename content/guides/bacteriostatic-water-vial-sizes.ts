import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

/** Draw counts for the standard vial, derived rather than typed. */
const drawsAt1ml = FACTS.vialMl;
const drawsAt2ml = FACTS.vialMl / 2;
const drawsAtHalfMl = FACTS.vialMl * 2;
/** Whole weeks inside the in-use limit. */
const weeksInLimit = Math.floor(FACTS.openedLimitDays / 7);

export const vialSizes: Guide = {
  slug: "bacteriostatic-water-vial-sizes",
  title: "Bacteriostatic water vial sizes: 3 ml, 10 ml, 20 ml and 30 ml compared",
  metaTitle: "Bacteriostatic water vial sizes UK: 3, 10, 20 or 30 ml?",
  description:
    "UK bacteriostatic water comes in 3, 10, 20 and 30 ml vials. How many draws each gives, why the 28-day in-use limit matters and where 30 ml imports fit.",
  quickAnswer: `UK sellers offer bacteriostatic water in 3, 10, 20 and 30 ml vials. An opened vial is discarded ${FACTS.openedLimitDays} days after first puncture, so the right size is the one you will finish within that window. For laboratory work drawing 0.5 ml to 2 ml at a time, a ${FACTS.vialMl} ml vial fits the limit with little left over.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "Which bacteriostatic water vial sizes are sold in the UK?",
      paragraphs: [
        `Four sizes turn up in UK listings: 3 ml, 10 ml, 20 ml and 30 ml. They all contain the same liquid, sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol (${FACTS.benzylAlcoholMgPerMl}) as a preservative, in a glass vial closed with a rubber stopper and an aluminium crimp. What changes is the volume, who sells it, and how much of it you will realistically use before the in-use limit.`,
        `The ${FACTS.vialMl} ml vial is the common UK laboratory size and the one most UK-based diluent sellers stock. The 30 ml vial is a US product that some UK resellers import. The 3 ml and 20 ml sizes are less common and tend to appear on marketplaces or as part of bundles rather than as a seller's main line.`,
      ],
      table: {
        caption: "Bacteriostatic water vial sizes available in the UK",
        columns: ["Size", "Who typically sells it", "Draws at 1 ml", "Note"],
        rows: [
          [
            "3 ml",
            "Research-chemical sellers and marketplace listings, often in bundles",
            "3",
            "Empties in days. The glass, stopper and crimp cost the same as a larger vial, so the price per millilitre is usually higher.",
          ],
          [
            `${FACTS.vialMl} ml`,
            "UK laboratory-supply and research diluent sellers, including BacLab",
            `${drawsAt1ml}`,
            `The common UK laboratory size. Fits inside the ${FACTS.openedLimitDays}-day in-use limit for most draw rates.`,
          ],
          [
            "20 ml",
            "Occasional marketplace and research-chemical listings",
            "20",
            "Less common in the UK. Check the source and the label; the fill and closure vary between sellers.",
          ],
          [
            "30 ml",
            "US manufacturers (Hospira, Pfizer), imported by some UK resellers",
            "30",
            "Sold at a higher price. At weekly draws, most of the vial is still inside when the in-use limit ends.",
          ],
        ],
      },
    },
    {
      heading: "Is a 30 ml vial better value than a 10 ml vial?",
      paragraphs: [
        `On price per millilitre, a larger vial usually looks better. That comparison ignores the label. Once the stopper has been punctured, the in-use limit is ${FACTS.openedLimit}, whatever the size of the vial. After that the contents are discarded, including whatever is still inside.`,
        `The arithmetic is unforgiving for low-volume work. A 30 ml vial opened and drawn from at 1 ml a week gives ${weeksInLimit} draws in ${FACTS.openedLimitDays} days. That is ${weeksInLimit} ml used and ${30 - weeksInLimit} ml discarded, so most of the vial, and most of the money, goes in the bin. A ${FACTS.vialMl} ml vial used at the same rate also leaves some behind, but far less of it, and the vial cost less in the first place.`,
        `The useful measure is not price per millilitre on the shelf but price per millilitre actually used. For anyone drawing a few millilitres a month, the ${FACTS.vialMl} ml vial usually comes out ahead on that measure, and it does so without any special handling.`,
        "A 3 ml vial has the opposite problem. At 1 ml a draw it is empty after three draws, well inside the in-use window, so nothing is thrown away, but you are opening a new vial every few days and paying for new glass, a new stopper and a new crimp each time.",
      ],
    },
    {
      heading: `How many draws does a ${FACTS.vialMl} ml vial give?`,
      paragraphs: [
        `Draws per vial is simple division: nominal volume divided by draw volume. For the ${FACTS.vialMl} ml size:`,
      ],
      list: [
        `${drawsAt1ml} draws of 1 ml`,
        `${drawsAt2ml} draws of 2 ml`,
        `${drawsAtHalfMl} draws of 0.5 ml`,
      ],
      table: {
        caption: `What a ${FACTS.vialMl} ml vial delivers inside the ${FACTS.openedLimitDays}-day in-use limit`,
        columns: ["Draw volume", "Frequency", `Draws in ${FACTS.openedLimitDays} days`, "Used", "Left over"],
        rows: [
          ["0.5 ml", "Daily", `${drawsAtHalfMl} (vial empty on day ${drawsAtHalfMl})`, `${FACTS.vialMl} ml`, "None"],
          ["1 ml", "Daily", `${drawsAt1ml} (vial empty on day ${drawsAt1ml})`, `${FACTS.vialMl} ml`, "None"],
          ["1 ml", "Twice a week", `${weeksInLimit * 2}`, `${weeksInLimit * 2} ml`, `${FACTS.vialMl - weeksInLimit * 2} ml discarded`],
          ["1 ml", "Weekly", `${weeksInLimit}`, `${weeksInLimit} ml`, `${FACTS.vialMl - weeksInLimit} ml discarded`],
          ["2 ml", "Weekly", `${weeksInLimit}`, `${weeksInLimit * 2} ml`, `${FACTS.vialMl - weeksInLimit * 2} ml discarded`],
        ],
      },
    },
    {
      heading: "What is Hospira or Pfizer bacteriostatic water, and is it sold in the UK?",
      paragraphs: [
        "Hospira, now part of Pfizer, manufactures a 30 ml vial labelled Bacteriostatic Water for Injection, USP. That is a United States pharmacopoeial product name: the vial is made to the USP monograph for the US market. It is not a UK-licensed product and UK pharmacies do not generally stock it. Some UK resellers import it and list it at a higher price than a UK-supplied vial, which reflects the import route as much as the larger volume.",
        `Its stated composition is the same as the standard laboratory diluent: sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol. A UK-supplied ${FACTS.vialMl} ml laboratory diluent with the same benzyl alcohol content is the usual alternative. That is a statement about composition only, not a comparison of quality, and each product stands on its own label and documentation.`,
        "Searches for Hospira or Pfizer bacteriostatic water in the UK mostly lead to imported 30 ml listings, and sometimes to marketplace listings whose origin is harder to establish. Whichever you look at, check that the seller is identifiable, that the label in the photograph matches the description, and that the expiry date is printed and current.",
      ],
    },
    {
      heading: `Why does BacLab sell only ${FACTS.vialMl} ml vials?`,
      paragraphs: [
        `BacLab sells one product: a sealed ${FACTS.vialMl} ml vial, in packs from 1 to 100. There is no 3 ml, 20 ml or 30 ml option, and that is a deliberate choice rather than a gap in the range.`,
        `The ${FACTS.vialMl} ml size fits the ${FACTS.openedLimitDays}-day in-use limit for the draw volumes laboratories typically use. Buyers who need more volume buy a bigger pack and pay less per vial through pack pricing, rather than paying for a bigger vial. Ten sealed ${FACTS.vialMl} ml vials hold more than three 30 ml vials, but each one is opened only when it is needed, so the in-use clock runs on one vial at a time and the rest stay sealed under their printed expiry.`,
        "One size also means one label, one safety data sheet, one set of storage instructions and one price list. That is simpler to keep accurate, and simpler for a buyer comparing packs than a range of sizes with different fills and closures.",
      ],
    },
    {
      heading: "What should you check on the label, whatever the size?",
      paragraphs: [
        "Vial size changes nothing on this list. A 30 ml import and a 10 ml UK vial should both carry every item, and a listing that shows none of them, or a photograph of a label that does not match the description, is a reason to look elsewhere.",
      ],
      list: [
        `**Composition**: sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol. If the label says sterile water only, it has no preservative and is single-use once opened.`,
        "**Nominal volume** in ml, with a fill level that looks right for it.",
        "**Expiry date** for the unopened vial. Unopened, the printed expiry governs; a typical shelf life is around two years, but the label decides.",
        `**In-use limit** after first puncture, normally ${FACTS.openedLimit}.`,
        "**Batch or lot number**, so the vial can be traced and matched to a certificate or safety data sheet.",
        "**Seal and closure**: an intact aluminium crimp and flip cap over a stopper that has not been punctured.",
        `**Appearance**: ${FACTS.appearance.toLowerCase()}. Cloudy, discoloured or particulate contents are discarded regardless of the date.`,
        "**Storage instructions**: room temperature away from light unless the label says otherwise. Once opened, many laboratories refrigerate at 2–8 °C.",
      ],
    },
  ],
  faq: [
    {
      q: "Is bacteriostatic water 30 ml available in the UK?",
      a: `Yes, from some UK resellers who import the US 30 ml product, usually at a higher price than a UK-supplied ${FACTS.vialMl} ml vial. UK pharmacies do not generally stock it. Before choosing it, check that you will use most of 30 ml within ${FACTS.openedLimitDays} days of first puncture.`,
    },
    {
      q: `What is the difference between ${FACTS.vialMl} ml and 30 ml bacteriostatic water?`,
      a: `Only the volume. Both are sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol. A 30 ml vial gives three times the draws but is still discarded ${FACTS.openedLimitDays} days after first puncture, so for low-volume laboratory use most of it is never drawn.`,
    },
    {
      q: `How many draws do I get from a ${FACTS.vialMl} ml vial?`,
      a: `${drawsAt1ml} draws of 1 ml, ${drawsAt2ml} draws of 2 ml or ${drawsAtHalfMl} draws of 0.5 ml. A little stays in the vial and in the equipment used to draw it, so plan on one fewer than the arithmetic gives.`,
    },
    {
      q: "Is a 3 ml vial of bacteriostatic water worth buying?",
      a: `It suits work that needs only a millilitre or two in total. For regular draws it empties within days, and because the glass, stopper and crimp cost the same whatever is inside, the price per millilitre is usually higher than a ${FACTS.vialMl} ml vial.`,
    },
    {
      q: "Is Hospira bacteriostatic water the same as UK bacteriostatic water?",
      a: `The Hospira and Pfizer product is Bacteriostatic Water for Injection, USP, a 30 ml vial made for the US market. A UK laboratory diluent has the same stated composition, sterile water with ${FACTS.benzylAlcoholPct} benzyl alcohol. That is a statement about composition only; check each product's own label and documentation.`,
    },
    {
      q: "Why does BacLab not sell 30 ml vials?",
      a: `Because a ${FACTS.vialMl} ml vial fits the ${FACTS.openedLimitDays}-day in-use limit for the draw volumes laboratories typically use. Buyers who need more volume buy a bigger pack and pay less per vial, opening one vial at a time while the rest stay sealed.`,
    },
  ],
  related: ["where-to-buy-bacteriostatic-water-uk", "how-long-does-bacteriostatic-water-last"],
};
