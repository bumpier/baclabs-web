import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const whatIsBacteriostaticWater: Guide = {
  slug: "what-is-bacteriostatic-water",
  title: "What is bacteriostatic water?",
  metaTitle: "What is bacteriostatic water? Meaning and how it differs",
  description:
    "Sterile water with a bacteriostatic preservative. What the preservative does, what a multi-dose vial is, and how it differs from sterile water.",
  quickAnswer:
    "Bacteriostatic water is sterile, purified water containing a bacteriostatic preservative. The preservative inhibits bacterial growth inside the vial after the stopper is first punctured, which is what allows one vial to be drawn from repeatedly. It is sold as a diluent for reconstituting or diluting substances for laboratory and research purposes.",
  updated: "2026-09-10",
  sections: [
    {
      heading: "What is bacteriostatic water?",
      paragraphs: [
        "Bacteriostatic water is sterile water to which a bacteriostatic preservative has been added. Nothing else is in the vial: no salt, no buffer, no other additive. The word bacteriostatic describes what the preservative does. Static means to hold still, so a bacteriostatic agent holds bacterial numbers where they are rather than killing what is already present.",
        "It is commonly shortened to bac water, and you will also see it written as BAC water, bacteriostatic mixing water or simply mixing water. All of these names refer to the same thing: water with a low concentration of a bacteriostatic preservative, supplied sterile in a sealed glass vial with a rubber stopper and a crimped aluminium collar.",
        `[The ${FACTS.vialMl} ml vial](/#buy) is the size that is standard in UK laboratories. A product labelled as sterile water only, with no preservative stated, is not the same thing.`,
      ],
    },
    {
      heading: "What does the preservative do, and what does it not do?",
      paragraphs: [
        "The preservative is present at a level that stops most common bacteria and some fungi from multiplying in the water if a small number are introduced through the stopper. Every time liquid is drawn from a vial there is a chance that a few organisms enter with the air that replaces it. In plain sterile water those organisms can multiply freely. In bacteriostatic water the preservative holds them in check.",
        "**It inhibits growth. It does not sterilise.** The preservative is not a disinfectant and not a sterilant. It will not clean up a vial that has been heavily contaminated, it will not remove particles or endotoxins, and it does nothing for a vial whose contents were already compromised when the seal was broken. The preservative buys time between punctures; it is not a substitute for clean handling.",
        `That is also why the preservative has a limit. The label gives an in-use period of ${FACTS.openedLimit}, after which the vial is conventionally discarded whatever remains in it. The in-use period, storage and the signs of spoilage are covered in [the guide on how long bacteriostatic water lasts](/guides/how-long-does-bacteriostatic-water-last).`,
      ],
    },
    {
      heading: "What is a multi-dose vial, and why does the preservative matter?",
      paragraphs: [
        "Multi-dose vial is a packaging term. It describes a sealed vial with a rubber stopper that is designed to be punctured and drawn from more than once over a period of days or weeks, as opposed to a single-use vial or ampoule that is opened once and then discarded along with anything left in it.",
        "What makes a vial multi-dose is not the glass, the stopper or the size. It is the preservative. Once a stopper has been punctured the contents are no longer guaranteed sterile, because air and whatever is on the stopper surface can enter. A vial without a preservative has no defence against that, so it has to be treated as single-use. A vial with a bacteriostatic preservative can tolerate repeated entry within its in-use period because any organisms that get in are prevented from multiplying.",
        `That is the whole reason bacteriostatic water exists as a separate product. Sterile water does the same job as a diluent, but only once. Bacteriostatic water does it repeatedly from the same ${FACTS.vialMl} ml vial, for up to ${FACTS.openedLimit}.`,
      ],
    },
    {
      heading: "Is bacteriostatic water the same as sterile water or saline?",
      paragraphs: [
        "No. All three are clear, sterile, water-based liquids supplied in similar vials, which is why they are confused, but they differ in what is dissolved in them and in whether the vial can be re-entered after opening.",
        "Sterile water is purified water with nothing added. It has no preservative, so once the seal is broken it is single-use. Sodium chloride 0.9%, usually called saline or normal saline, is water containing 9 g of sodium chloride per litre, which makes it isotonic. Ordinary saline also has no preservative and is single-use once opened. A bacteriostatic saline exists in some markets, with a preservative added, but it is a different product from bacteriostatic water because it contains salt.",
        "Bacteriostatic water is the only one of the three that is **both salt-free and preserved**. The full comparison, including when the absence of a preservative matters, is in [the guide on bacteriostatic water versus sterile water](/guides/bacteriostatic-water-vs-sterile-water).",
      ],
      table: {
        caption: "Bacteriostatic water, sterile water and saline compared",
        columns: ["Property", "Bacteriostatic water", "Sterile water", "Sodium chloride 0.9% (saline)"],
        rows: [
          ["Solute", "Bacteriostatic preservative", "None", "Sodium chloride 0.9% w/v"],
          ["Preservative", "Yes", "No", "No, unless labelled bacteriostatic"],
          ["Salt content", "None", "None", "9 g per litre (isotonic)"],
          ["Re-entry after first puncture", `Yes, within ${FACTS.openedLimit}`, "No, single-use", "No, single-use unless labelled bacteriostatic"],
          ["Typical pack", `Multi-dose vial, ${FACTS.vialMl} ml common in the UK`, "Single-use ampoule or vial", "Single-use ampoule, vial or bag"],
        ],
      },
    },
    {
      heading: "What is bacteriostatic water used for?",
      paragraphs: [
        "Bacteriostatic water is used for reconstituting or diluting substances for laboratory and research purposes. A substance supplied as a dry powder is dissolved in a measured volume of the diluent to give a solution of known concentration, and a solution that is too concentrated is diluted with it to reach the working concentration required. Because the diluent is preserved, **one vial can serve several preparations** over its in-use period rather than being discarded after the first.",
        "It is chosen over plain sterile water when a vial will be entered more than once, and over saline when the preparation should not contain sodium chloride. Where the substance being dissolved is known to be incompatible with the preservative, sterile water is used instead and the vial is treated as single-use.",
        "In the UK it is supplied as a laboratory and research diluent only. There is no licensed bacteriostatic-water medicine sold over the counter, and UK pharmacies do not generally stock it.",
      ],
    },
    {
      heading: "What does bacteriostatic water look like, and is it classified as hazardous?",
      paragraphs: [
        `${FACTS.appearance}. It looks identical to plain water; the preservative is fully dissolved and does not tint the liquid. A faint, slightly aromatic smell is sometimes noticeable on opening. Any cloudiness, colour or visible particles means the vial should be discarded.`,
        "Because it is a mixture rather than a single substance, bacteriostatic water has no CAS number of its own. The water it is made from does, and it is listed below together with the EC number, formula and molecular weight that appear on a specification sheet.",
        "The preservative is present below the generic concentration limits at which a mixture inherits the classification of its components, so the diluent is not classified.",
      ],
      list: [
        `Water: CAS ${FACTS.casWater}, EC ${FACTS.ecWater}, ${FACTS.formulaWater}, ${FACTS.molecularWeightWater} g/mol`,
        `Appearance: ${FACTS.appearance}`,
        `Hazard classification: ${FACTS.hazardClassification}`,
      ],
    },
  ],
  faq: [
    {
      q: "What does bac water mean?",
      a: "Bac water is the everyday abbreviation of bacteriostatic water. It means sterile water with a bacteriostatic preservative. BAC water and bacteriostatic mixing water are the same thing.",
    },
    {
      q: "Is bacteriostatic water the same as sterile water?",
      a: "No. Sterile water contains no preservative and is single-use once opened. Bacteriostatic water is sterile water with a bacteriostatic preservative added, which allows the vial to be re-entered within its in-use period.",
    },
    {
      q: "Does the preservative sterilise the water?",
      a: "No. The water is sterile because of how it is manufactured and sealed. The preservative only inhibits the growth of organisms that may enter after the stopper is punctured. It does not kill an existing contamination or make a spoiled vial usable.",
    },
    {
      q: "Is bacteriostatic water classified as hazardous?",
      a: `No. The preservative is present below the concentration limits at which a mixture inherits the classification of its components. ${FACTS.hazardClassification}.`,
    },
  ],
  related: ["bacteriostatic-water-vs-sterile-water", "how-long-does-bacteriostatic-water-last"],
};
