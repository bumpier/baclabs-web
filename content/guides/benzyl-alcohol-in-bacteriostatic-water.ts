import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const benzylAlcoholInBacteriostaticWater: Guide = {
  slug: "benzyl-alcohol-in-bacteriostatic-water",
  title: "What does the 0.9% benzyl alcohol in bacteriostatic water do?",
  metaTitle: "Benzyl alcohol in bacteriostatic water: what 0.9% does",
  description: `Why bacteriostatic water contains ${FACTS.benzylAlcoholPct} benzyl alcohol, how the preservative works, bacteriostatic versus bactericidal, and its GB CLP classification.`,
  quickAnswer: `Benzyl alcohol is the preservative in bacteriostatic water. At ${FACTS.benzylAlcoholPct}, which is ${FACTS.benzylAlcoholMgPerMl}, it disrupts the cell membranes of bacteria that enter a vial after the stopper is punctured, so they cannot multiply. It is bacteriostatic, not bactericidal: it holds contamination in check for the in-use period but does not sterilise the water or rescue a spoiled vial.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "What is benzyl alcohol?",
      paragraphs: [
        `Benzyl alcohol is an aromatic alcohol: a benzene ring with a single hydroxymethyl group attached. Its formula is ${FACTS.formulaBenzylAlcohol}, its molecular weight is ${FACTS.molecularWeightBenzylAlcohol} g/mol, and its CAS registry number is ${FACTS.casBenzylAlcohol} (EC ${FACTS.ecBenzylAlcohol}). At room temperature it is a colourless liquid with a faint, slightly sweet odour. It occurs naturally in a number of plant oils, and it is manufactured in bulk for use as a solvent and as a preservative in a wide range of formulations.`,
        "Roughly 4 g will dissolve in 100 mL of water at room temperature, so the level used in bacteriostatic water is well within its solubility and the solution stays clear and homogeneous. There is no visible sign of the preservative in the vial. The only clue is the faint aromatic smell that is sometimes noticeable when a fresh vial is opened.",
        `In bacteriostatic water it is the only thing added to purified water (CAS ${FACTS.casWater}). There is no salt, no buffer and no second preservative. The whole difference between bacteriostatic water and plain sterile water is this one ingredient at ${FACTS.benzylAlcoholPct}.`,
      ],
    },
    {
      heading: "How does benzyl alcohol work as a preservative?",
      paragraphs: [
        "Benzyl alcohol acts on bacteria in two related ways. The aromatic ring makes the molecule partly lipophilic, so it partitions into the lipid bilayer of a bacterial cell membrane. Once there it disorders the membrane, increasing its permeability and letting small ions and metabolites leak out. At the same time it interferes with the folding and function of membrane-associated proteins, including the enzymes and transport systems the cell relies on to take in nutrients and generate energy.",
        "Neither effect is dramatic at low concentration. A cell exposed to benzyl alcohol at the level found in bacteriostatic water is not ruptured or dissolved. It is put under enough stress that it cannot complete the processes needed to divide. Growth slows and then stops. Over the in-use period of the vial, a small population of organisms that entered through the stopper therefore stays small instead of growing into a visible, cloudy contamination.",
        "This is the mechanism behind the word bacteriostatic. Static means held still. The preservative holds bacterial numbers where they are; it does not reduce them to zero.",
      ],
    },
    {
      heading: "What is the difference between bacteriostatic, bactericidal and sterile?",
      paragraphs: [
        "Bacteriostatic and bactericidal describe what an agent does to bacteria. Sterile describes the state of a material.",
        "A **bacteriostatic** agent stops bacteria from multiplying without necessarily killing them. Remove the agent and the surviving cells can resume growth. A **bactericidal** agent kills bacteria outright, so the population falls rather than staying level. **Sterile** means free of all viable organisms, including bacterial spores and fungi, and it is achieved by a manufacturing process such as filtration or heat, not by an additive in the liquid.",
        `Bacteriostatic water is sterile when the seal is intact because of how it was filtered, filled and sealed. The benzyl alcohol has nothing to do with that. Its job starts when the stopper is first punctured and the guarantee of sterility ends. From that point it keeps whatever small number of organisms entered from multiplying, for up to ${FACTS.openedLimit}.`,
        "This is also why the preservative cannot rescue a contaminated vial. If a vial has been left open, drawn from with a dirty needle, stored warm for weeks, or is already cloudy, the organisms present may be too numerous, too resistant or too far along for a bacteriostatic agent to matter. Benzyl alcohol at this concentration is not a disinfectant. It does not remove particles, it does not remove endotoxins released by dead bacteria, and it does not act against every organism equally. A vial that shows any sign of spoilage is discarded regardless of what is preserving it.",
      ],
      table: {
        caption: "Bacteriostatic, bactericidal and sterile compared",
        columns: ["Term", "What it means", "Effect on bacteria present", "How it applies to bacteriostatic water"],
        rows: [
          [
            "Bacteriostatic",
            "Inhibits multiplication",
            "Population stays level; growth resumes if the agent is removed",
            `What ${FACTS.benzylAlcoholPct} benzyl alcohol does after the stopper is punctured`,
          ],
          [
            "Bactericidal",
            "Kills bacteria",
            "Population falls",
            "Not what the preservative does at this concentration",
          ],
          [
            "Sterile",
            "Free of all viable organisms",
            "None present",
            "The state of the sealed vial, achieved by manufacture, not by the preservative",
          ],
        ],
      },
    },
    {
      heading: `Why is the concentration ${FACTS.benzylAlcoholPct}, and is that the same as v/v?`,
      paragraphs: [
        `The concentration is set by the pharmacopoeial specification for the product, and ${FACTS.benzylAlcoholPct} is the figure every reputable supplier quotes. It is enough to hold bacterial growth in check for the in-use period while staying below the 1% level at which the mixture would have to carry a hazard classification, as the next section explains.`,
        `The w/v notation matters. It stands for weight per volume: ${FACTS.benzylAlcoholPct} means 0.9 g of benzyl alcohol in every 100 mL of finished solution, which is the same as ${FACTS.benzylAlcoholMgPerMl}. A ${FACTS.vialMl} ml vial therefore contains ${FACTS.benzylAlcoholMgPerVial} mg of benzyl alcohol in total.`,
        "Volume per volume, written v/v, would describe how many millilitres of benzyl alcohol were mixed into 100 mL of solution. Because benzyl alcohol is slightly denser than water, at about 1.044 g/mL, 0.9 g of it occupies only about 0.86 mL. On a v/v basis the same product is therefore about 0.86%. The two figures describe the same vial, but a specification that says 0.9% v/v is describing a slightly stronger solution of roughly 9.4 mg/mL. When comparing data sheets, always check which basis is being used.",
      ],
      list: [
        `Weight per volume: ${FACTS.benzylAlcoholPct}, the labelled figure`,
        `Mass concentration: ${FACTS.benzylAlcoholMgPerMl}, the same figure per millilitre`,
        "Volume per volume: about 0.86% v/v, using a density of about 1.044 g/mL",
        `Per ${FACTS.vialMl} ml vial: ${FACTS.benzylAlcoholMgPerVial} mg of benzyl alcohol`,
      ],
    },
    {
      heading: `Is ${FACTS.benzylAlcoholPct} benzyl alcohol classified as hazardous?`,
      paragraphs: [
        `${FACTS.hazardClassification}. That is the classification of the mixture as sold, and it is what appears on the safety data sheet for the product.`,
        `The pure substance is a different matter. Benzyl alcohol on its own is classified under GB CLP as Acute Tox. 4 (oral and inhalation) and Eye Irrit. 2. A mixture inherits those classifications only if the substance is present at or above a generic concentration limit, and the limits are 1% for acute toxicity category 4 and 10% for eye irritation category 2. At ${FACTS.benzylAlcoholPct} the diluent is below both, so neither classification carries through to the mixture. This is one of the reasons the concentration is set where it is.`,
        "Falling below the threshold does not make it plain water in every respect. Ordinary practice for any chemical solution still applies, and the safety data sheet for the diluent should be kept with the laboratory's chemical inventory like any other.",
      ],
    },
    {
      heading: "Does benzyl alcohol interfere with laboratory work?",
      paragraphs: [
        "For most dilution work it does not. There are three situations where the preservative is a solvent with properties of its own, and where plain sterile water is the better choice.",
        "**Cell culture.** Benzyl alcohol is cytotoxic to cells in culture at the concentration found in bacteriostatic water. The same membrane-disordering effect that stops bacteria dividing affects cultured cells, which have no cell wall to protect them. Bacteriostatic water is therefore not a suitable diluent for anything that will be added to a culture, and it is not a substitute for a culture medium or a buffered salt solution.",
        "**UV spectrophotometry.** The benzene ring absorbs in the ultraviolet, with a strong band in the low 200 nm region and weaker absorbance around 250 to 270 nm. A sample dissolved in bacteriostatic water carries that absorbance with it, overlapping the wavelengths used to measure protein and nucleic acid concentration. A blank from the same diluent corrects for some of this, but where UV accuracy matters an unpreserved solvent avoids the problem. Benzyl alcohol can also appear as an extra peak in chromatography and mass spectrometry.",
        "**Plastics.** Benzyl alcohol is a mild organic solvent. Over long contact it can soften, cloud or leach additives from some plastics, particularly polystyrene and certain acrylics, and it can swell some elastomers. Brief contact with polypropylene tips and tubes is not a concern in normal use. Prolonged storage of diluted solutions in unsuitable plastic containers is, and the diluent should be kept in its original glass vial rather than decanted for storage.",
      ],
    },
    {
      heading: "Does the preservative change how the vial is stored and handled?",
      paragraphs: [
        `It does not extend the in-use period. The in-use limit on the label, ${FACTS.openedLimit}, is set with the preservative already taken into account. It is the period over which the manufacturer has shown that the benzyl alcohol holds contamination in check under normal handling. Beyond it the vial is discarded, whether or not it looks fine and whatever volume remains. The preservative is the reason the limit is ${FACTS.openedLimitDays} days rather than one session; it is not a reason to stretch the limit further.`,
        "Storage of an unopened vial is unaffected by the preservative. It is kept at room temperature, away from direct light, until the expiry printed on the label. Benzyl alcohol is stable in solution over that period and does not need refrigeration to remain effective. Once the vial has been opened, many laboratories refrigerate it at 2 to 8 °C, which slows the metabolism of any organisms present and complements the preservative rather than replacing it.",
        "Handling is the same as for any multi-use vial. The stopper is wiped and allowed to dry before each puncture, a fresh sterile transfer device is used each time, and the date of first puncture is written on the label. The preservative reduces the consequences of a small lapse in that routine. It does not make the routine optional.",
        `${FACTS.appearance} is what the diluent should look like throughout its in-use period. Cloudiness, colour, visible particles or an unusual smell all mean the vial is discarded, and the preservative does not change that rule.`,
      ],
    },
  ],
  faq: [
    {
      q: "Why does bacteriostatic water contain benzyl alcohol?",
      a: `Benzyl alcohol is the preservative. At ${FACTS.benzylAlcoholPct} it stops bacteria that enter through the stopper from multiplying, which is what allows one vial to be drawn from repeatedly for up to ${FACTS.openedLimit} instead of being single-use.`,
    },
    {
      q: "Is bacteriostatic the same as bactericidal?",
      a: `No. Bacteriostatic means growth is inhibited; the organisms are held in check but not killed. Bactericidal means the organisms are killed. Benzyl alcohol at ${FACTS.benzylAlcoholPct} is bacteriostatic, which is why it cannot clean up a vial that is already contaminated.`,
    },
    {
      q: `Is ${FACTS.benzylAlcoholPct} benzyl alcohol classified as hazardous?`,
      a: `No. ${FACTS.hazardClassification}. Pure benzyl alcohol is classified as Acute Tox. 4 and Eye Irrit. 2, but the mixture falls below the generic concentration limits at which those classifications apply.`,
    },
    {
      q: `Is ${FACTS.benzylAlcoholPct} the same as 0.9% v/v?`,
      a: `No. Benzyl alcohol has a density of about 1.044 g/mL, so 0.9 g occupies about 0.86 mL. The labelled ${FACTS.benzylAlcoholPct} is about 0.86% v/v. A product quoted at 0.9% v/v is slightly stronger, at roughly 9.4 mg/mL.`,
    },
    {
      q: "Can bacteriostatic water be used for cell culture?",
      a: "No. Benzyl alcohol is cytotoxic to cells in culture at this concentration. Anything destined for a culture should be prepared in an unpreserved diluent or the appropriate medium.",
    },
    {
      q: "Does the preservative extend the in-use period?",
      a: `No. The in-use limit of ${FACTS.openedLimit} already takes the preservative into account. It is the reason the vial is multi-use at all, not a reason to keep the vial longer.`,
    },
  ],
  related: ["what-is-bacteriostatic-water", "bacteriostatic-water-vs-sterile-water"],
};
