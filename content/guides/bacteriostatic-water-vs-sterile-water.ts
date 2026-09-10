import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const bacteriostaticVsSterileWater: Guide = {
  slug: "bacteriostatic-water-vs-sterile-water",
  title: "Bacteriostatic water vs sterile water vs saline: what is the difference?",
  metaTitle: "Bacteriostatic water vs sterile water vs saline",
  description:
    "The one real difference between bacteriostatic water, sterile water and saline, with a comparison table and when each is the right laboratory diluent.",
  quickAnswer: `Bacteriostatic water is sterile water with a bacteriostatic preservative added, so an opened vial can be used repeatedly for up to ${FACTS.openedLimit}. Plain sterile water has no preservative and is single-use once opened. Saline is 0.9% sodium chloride in sterile water, isotonic, and also unpreserved unless labelled bacteriostatic.`,
  updated: "2026-09-10",
  sections: [
    {
      heading: "What are bacteriostatic water, sterile water and saline?",
      paragraphs: [
        "All three are clear, colourless, sterile liquids sold in sealed vials, ampoules or bottles, and all three are used as solvents or diluents in laboratory work. They look identical in the vial, which is why the names get confused. The difference is what has been dissolved in the water before it was sterilised and sealed.",
        `**Bacteriostatic water** is purified water (CAS ${FACTS.casWater}) with a bacteriostatic preservative added. It is filtered, filled into a multi-use vial with a rubber stopper and crimped collar, and sterilised. In the United States the pharmacopoeial product is named Bacteriostatic Water for Injection, USP; in the UK it is sold as a laboratory and research diluent.`,
        "**Sterile water** is purified water that has been sterilised and sealed with nothing else added. It contains no preservative, no salt and no buffer. It is the simplest of the three and the one most laboratories already have on the shelf in some form.",
        "**Saline** is 0.9% w/v sodium chloride dissolved in sterile water. The salt is there to make the solution isotonic, that is, matched to the osmotic pressure of living cells and tissue. Ordinary saline contains no preservative either, so once opened it is treated exactly like sterile water.",
      ],
    },
    {
      heading: "What is the difference between bacteriostatic water and sterile water?",
      paragraphs: [
        `There is only one real difference: bacteriostatic water contains a bacteriostatic preservative and sterile water does not. Everything else that people list, such as purity, clarity, pH or sterility at the point of sealing, is the same for both. The water is the same water.`,
        `That one ingredient changes how the vial can be used. Once a stopper has been punctured, air and anything on the needle or in the room can enter the vial. In plain sterile water any bacteria introduced can multiply freely, so the vial is single-use and the remainder is discarded. In bacteriostatic water the preservative inhibits bacterial growth, so the same vial can be entered repeatedly for up to ${FACTS.openedLimit}, [the in-use limit printed on the label](/guides/how-to-read-a-vial-label).`,
        "It is worth being precise about what the preservative does. It is **bacteriostatic, not bactericidal**: it slows and stops bacteria from multiplying, it does not sterilise, and it does not rescue a vial that has been contaminated or handled carelessly. Cloudiness, colour, particles or a vial past its in-use limit are all reasons to discard it regardless of the preservative.",
        "The table below sets the three liquids side by side on the points that actually differ in practice.",
      ],
      table: {
        caption: "Bacteriostatic water, sterile water and saline compared",
        columns: ["", "Bacteriostatic water", "Sterile water", "Saline (0.9% sodium chloride)"],
        rows: [
          [
            "Preservative",
            "Bacteriostatic preservative",
            "None",
            "None, unless labelled bacteriostatic saline",
          ],
          [
            "In-use period once opened",
            FACTS.openedLimit,
            "Same session only; discard any remainder",
            "Same session only; discard any remainder",
          ],
          ["Single or multi-use", "Multi-use", "Single-use", "Single-use"],
          [
            "Tonicity",
            "Hypotonic (no salt)",
            "Hypotonic (no salt)",
            "Isotonic (0.9% w/v sodium chloride)",
          ],
          [
            "Typical container",
            `Multi-use vial with rubber stopper, ${FACTS.vialMl} ml is the common UK laboratory size`,
            "Single-use ampoule, vial or pour bottle",
            "Single-use ampoule, vial, bottle or bag",
          ],
        ],
      },
    },
    {
      heading: "Can you use sterile water instead of bacteriostatic water?",
      paragraphs: [
        "In a laboratory, often yes, and sometimes it is the better choice. The question to ask is whether the vial will be opened once or many times, and whether the preservative would get in the way of the work.",
        "Plain sterile water is the appropriate diluent when the whole vial or ampoule will be used in a single session. There is no need to preserve what is left because nothing is left. Many laboratories keep sterile water in small single-use ampoules for exactly this reason: open, use, discard, and the question of an in-use limit never arises.",
        "Sterile water is also the right choice where the preservative would interfere with the method. It can distort UV spectrophotometry readings of a sample dissolved in it, it is generally kept out of cell culture, and it can appear as an extra peak in chromatography or mass spectrometry. In any of these cases an unpreserved solvent is the cleaner option.",
        "The reverse substitution is where problems start. If a protocol calls for a preserved diluent because the same vial will be drawn from repeatedly over days or weeks, plain sterile water **is not a like-for-like replacement**. The first puncture ends its shelf life, and any later draw from that vial is a draw from an unpreserved, potentially contaminated liquid.",
      ],
      list: [
        "Whole vial used in one session: sterile water is appropriate.",
        "Method is sensitive to the preservative (UV absorbance, cell culture, chromatography): sterile water is appropriate.",
        `Vial will be entered repeatedly over up to ${FACTS.openedLimit}: bacteriostatic water is the intended diluent.`,
      ],
    },
    {
      heading: "What is the difference between bacteriostatic water and saline?",
      paragraphs: [
        "Bacteriostatic water and saline differ on two counts rather than one. Saline contains 0.9% sodium chloride and no preservative; bacteriostatic water contains a bacteriostatic preservative and no salt. They are chosen for different reasons and are not interchangeable in either direction.",
        "Saline is used where the protocol requires an isotonic solution. Some reagents, cell preparations and biological samples are stable only at physiological salt concentration, and dissolving or diluting them in salt-free water can cause them to precipitate, denature or lyse. In those cases the tonicity is the whole point, and water, preserved or not, is the wrong solvent.",
        "Saline is not a substitute for a preserved diluent. It has no preservative, so an opened vial or bag of ordinary saline is single-use in exactly the same way as sterile water. Choosing saline because a protocol calls for bacteriostatic water gains isotonicity that may not be wanted and loses the in-use period that was the reason for specifying a preserved diluent.",
        "Searches for bacteriostatic water vs sodium chloride are asking the same question with the chemical name. Sodium chloride 0.9% and normal saline are the same product; the comparison above applies.",
      ],
    },
    {
      heading: "What is bacteriostatic saline?",
      paragraphs: [
        `Bacteriostatic saline is 0.9% sodium chloride in sterile water with a bacteriostatic preservative added. It combines the isotonicity of saline with the multi-use in-use period of bacteriostatic water, and it is packaged in the same kind of stoppered multi-use vial.`,
        "It is a distinct product and must be labelled as such. A vial of saline that does not say bacteriostatic on the label contains no preservative and is single-use. Equally, **bacteriostatic saline is not bacteriostatic water**: the salt is still there, and a protocol that specifies a salt-free diluent cannot use it.",
        "Bacteriostatic saline is less commonly stocked in the UK than bacteriostatic water and is not the product described on this site. [BacLab supplies bacteriostatic water only](/#buy).",
      ],
    },
    {
      heading: "Which solvent should a laboratory use?",
      paragraphs: [
        "The choice of solvent for any experiment is determined by the laboratory's own protocol, the reagent manufacturer's reconstitution instructions and the method that will be run on the result. This guide describes what the three liquids are and how they behave in the vial; it does not override a written procedure.",
        "As a rule of thumb, the protocol will specify one of three things. If it specifies a preserved diluent, or a multi-use vial to be drawn from over days or weeks, bacteriostatic water is the intended product. If it specifies water with no additives, or the method is sensitive to the preservative, plain sterile water in single-use containers is the intended product. If it specifies an isotonic solution, saline is the intended product, and bacteriostatic saline only if the protocol also asks for a preservative.",
        "Where the protocol is silent, the safe reading is the conservative one: use the simplest liquid that meets the requirement, open a fresh single-use container where possible, and record which diluent was used so the result can be reproduced.",
      ],
    },
  ],
  faq: [
    {
      q: "Is bacteriostatic water the same as sterile water?",
      a: `No. Bacteriostatic water is sterile water with a bacteriostatic preservative added. The water itself is the same, but the preservative allows a bacteriostatic water vial to be used repeatedly for up to ${FACTS.openedLimit}, whereas sterile water is single-use once opened.`,
    },
    {
      q: "Can I use sterile water instead of bacteriostatic water?",
      a: "For single-session laboratory use, or where a preservative would interfere with an assay, plain sterile water is often the appropriate choice. It is not a substitute where a protocol specifies a preserved multi-use diluent, because sterile water has no in-use period once opened.",
    },
    {
      q: "Is saline the same as bacteriostatic water?",
      a: "No. Saline is 0.9% sodium chloride in sterile water with no preservative, chosen for its isotonicity. Bacteriostatic water contains a bacteriostatic preservative and no salt, chosen for its multi-use in-use period. Neither replaces the other.",
    },
    {
      q: "Does bacteriostatic water contain salt?",
      a: "No. Bacteriostatic water contains purified water and a bacteriostatic preservative only. The product that contains both sodium chloride and a preservative is bacteriostatic saline, which is a separate product and is labelled as such.",
    },
    {
      q: "What is bacteriostatic saline?",
      a: `Bacteriostatic saline is 0.9% sodium chloride in sterile water with a bacteriostatic preservative added. It is isotonic like saline and multi-use like bacteriostatic water. BacLab does not supply it.`,
    },
    {
      q: "Does the preservative in bacteriostatic water sterilise the vial?",
      a: "No. The preservative inhibits bacterial growth after the stopper is punctured; it does not kill organisms already present and does not make a contaminated vial safe. Discard any vial that is cloudy, discoloured, contains particles or is past its in-use limit.",
    },
  ],
  related: ["what-is-bacteriostatic-water", "how-to-store-bacteriostatic-water"],
};
