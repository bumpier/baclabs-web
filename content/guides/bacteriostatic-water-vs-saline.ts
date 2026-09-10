import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const bacteriostaticWaterVsSaline: Guide = {
  slug: "bacteriostatic-water-vs-saline",
  title: "Bacteriostatic water vs saline: what is the difference?",
  metaTitle: "Bacteriostatic water vs saline: the difference",
  description: `Bacteriostatic water is preserved water; saline is 0.9% sodium chloride, usually unpreserved. What each contains and how long each lasts once opened.`,
  quickAnswer: `Bacteriostatic water is purified water with a bacteriostatic preservative and nothing else dissolved in it. Saline is 0.9% sodium chloride in water, an isotonic salt solution, and is usually supplied without preservative. The practical difference is that one contains salt and the other does not, and that preserved vials can be re-entered while unpreserved ones cannot.`,
  updated: "2026-09-10",
  sections: [
    {
      heading: "What is the difference between bacteriostatic water and saline?",
      paragraphs: [
        `Two differences, and they are independent of each other. The first is what is dissolved in the water. Bacteriostatic water contains a bacteriostatic preservative and no salt. Saline contains 0.9 per cent sodium chloride by weight and, in its ordinary form, no preservative. A solution can be one, the other, both or neither.`,
        `The second is what happens after the stopper is punctured. A preservative inhibits bacterial growth inside the vial, which is what allows a vial to be entered more than once and makes it [multi-dose](/guides/what-multi-dose-means). An unpreserved vial has nothing working against organisms carried in on a needle, so it is treated as single-use and the remainder is discarded.`,
        `Both are clear, colourless liquids and both look identical in the vial. **The label is the only way to tell them apart**, which is why the fields on it matter more than the appearance of the contents.`,
      ],
      table: {
        caption: "Bacteriostatic water, sterile water and saline compared",
        columns: ["Solution", "Dissolved salt", "Preservative", "After first entry"],
        rows: [
          ["Bacteriostatic water", "None", "Yes", `Multi-dose, ${FACTS.openedLimit}`],
          ["Sterile water", "None", "No", "Single use, discard the remainder"],
          ["0.9% sodium chloride", "0.9% sodium chloride", "No", "Single use, discard the remainder"],
          ["Bacteriostatic sodium chloride", "0.9% sodium chloride", "Yes", "Multi-dose, per the label"],
        ],
      },
    },
    {
      heading: "What is 0.9% sodium chloride?",
      paragraphs: [
        `Saline is water with sodium chloride dissolved in it at 0.9 per cent by weight, which works out at nine grams per litre. That concentration is not arbitrary. It is close to the salt concentration of the fluids found in most cells and tissues, which is what the word isotonic describes, and it is the reason 0.9 per cent became the standard strength rather than any other.`,
        `In laboratory work the salt is doing something. It sets the osmotic strength of the solution, so cells and some proteins encounter an environment closer to the one they came from than they would in plain water. Where that matters, saline is the correct diluent and water is not.`,
        `Where it does not matter, the salt is simply another solute in the mixture. That is the case for a great deal of routine dilution work, and it is why plain water is the more common general-purpose diluent.`,
      ],
    },
    {
      heading: "Which one is preserved, and what does that change?",
      paragraphs: [
        `Bacteriostatic water is preserved by definition. Saline usually is not, although a preserved version exists and is labelled bacteriostatic sodium chloride. Read the label rather than assuming from the name of the solution.`,
        `A preservative inhibits the growth of bacteria that get into the vial. It does not sterilise the contents, it does not act instantly, and it does not make a vial that has been contaminated safe to carry on using. What it does is hold the line long enough that a sealed vial entered several times under clean conditions stays usable for a stated period.`,
        `**That period is the in-use limit**, and on a preserved vial it is ${FACTS.openedLimit}. On an unpreserved vial there is no equivalent period, because the intended pattern is one entry and then disposal.`,
      ],
    },
    {
      heading: "Does the salt change how things dissolve?",
      paragraphs: [
        "Sometimes. A solute that is sensitive to ionic strength behaves differently in saline than in water, and some materials are more soluble or more stable in one than the other. Where a supplier's own documentation names a diluent, that is the one to use, and substituting the other on the grounds that both are clear liquids is a mistake.",
        "Where no diluent is specified, plain water is the usual default for the simple reason that it adds nothing to the mixture. Every additional component in a diluent is a component in the final solution, and a diluent with no salt in it is one fewer variable to account for.",
        "Neither solution has any activity of its own. Both are carriers. What ends up mattering is the material being dissolved and what its own documentation says about the conditions it needs.",
      ],
    },
    {
      heading: "How long does each last once opened?",
      paragraphs: [
        `A preserved vial carries an in-use limit that starts at the first puncture. For bacteriostatic water that limit is ${FACTS.openedLimit}, and it runs on the calendar regardless of how much liquid is left. Whatever remains on day ${FACTS.openedLimitDays} is discarded.`,
        "An unpreserved vial, whether sterile water or ordinary saline, has no in-use period at all. It is drawn from once and the remainder goes. Keeping an opened unpreserved vial for a second session is **the most common way an otherwise careful workflow introduces contamination**.",
        "Unopened, both keep until the expiry printed on the vial. That date is batch-specific and belongs to the vial in front of you, so it is read from the label rather than assumed from a general figure.",
      ],
    },
    {
      heading: "Which should a laboratory keep in stock?",
      paragraphs: [
        `It depends on whether the work needs the salt. If the materials being dissolved are sensitive to ionic strength, or their documentation specifies a sodium chloride diluent, saline is the right stock item. If they are not, plain bacteriostatic water is the more flexible one, because it adds nothing and can be re-entered across a working period rather than being opened and discarded each time.`,
        `Many laboratories keep both for that reason, using the preserved water as the general-purpose diluent and reaching for saline only where a protocol calls for it. Where a single item has to cover general work, [a ${FACTS.vialMl} ml preserved vial](/#buy) covers more ground per unit bought, because the ${FACTS.openedLimitDays}-day window lets one vial serve a run of work instead of one session.`,
      ],
    },
  ],
  faq: [
    {
      q: "Is saline the same as bacteriostatic water?",
      a: "No. Saline is 0.9 per cent sodium chloride in water and usually contains no preservative. Bacteriostatic water contains a preservative and no salt. They are different solutions with different labels and different handling once opened.",
    },
    {
      q: "Can saline be substituted for bacteriostatic water?",
      a: "Only where the work does not depend on which diluent is used and the supplier's documentation does not specify one. The two differ in salt content and in whether the vial can be re-entered, so they are not interchangeable by default.",
    },
    {
      q: "Is there such a thing as bacteriostatic saline?",
      a: "Yes. Bacteriostatic sodium chloride is 0.9 per cent saline with a preservative added, so it has the salt of saline and the multi-entry handling of a preserved vial. It is a separate product with its own label and in-use limit.",
    },
    {
      q: "Which lasts longer once opened?",
      a: `The preserved one. Bacteriostatic water carries an in-use limit of ${FACTS.openedLimit}. Ordinary saline has no in-use period because it is single use once entered.`,
    },
    {
      q: "Does saline dissolve more than water?",
      a: "Not as a general rule. Solubility depends on the material. Some solutes are more stable in an isotonic salt solution and others are unaffected, so the material's own documentation decides rather than a rule about the diluent.",
    },
  ],
  related: ["bacteriostatic-water-vs-sterile-water", "what-is-bacteriostatic-water"],
};
