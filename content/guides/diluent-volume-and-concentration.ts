import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

/** Worked figures, derived so the arithmetic on the page is self-consistent. */
const vial = FACTS.vialMl;
/** A 10 mg solute made up in 1, 2 and 5 ml, in mg per ml. */
const at1ml = 10 / 1;
const at2ml = 10 / 2;
const at5ml = 10 / 5;
/** Vials needed to make up ten 2 ml preparations. */
const preparationsPerVial = vial / 2;

export const diluentVolumeAndConcentration: Guide = {
  slug: "diluent-volume-and-concentration",
  title: "Diluent volume and concentration: the arithmetic",
  metaTitle: "Bacteriostatic water: volume and concentration",
  description: `How the volume of diluent added sets the concentration of the solution, the units it is expressed in, and how to work back from a target.`,
  quickAnswer: `Concentration is the mass of solute divided by the volume of diluent it is made up in. Add less diluent and the solution is more concentrated; add more and it is less. The mass in the container does not change, only the volume it is distributed through, so the arithmetic is one division.`,
  updated: "2026-09-10",
  sections: [
    {
      heading: "How does diluent volume set concentration?",
      paragraphs: [
        `Concentration is mass divided by volume. A container holding a known mass of solid material has that mass whatever happens next. Adding diluent distributes it through a volume, and the concentration of the result is the mass divided by that volume.`,
        `Nothing about the diluent changes the mass. Bacteriostatic water is a carrier with no activity of its own, so it contributes volume and nothing else. That is what makes the arithmetic a single division rather than something requiring a correction factor.`,
        `The consequence is that the volume added is the only decision being made. Half the diluent gives twice the concentration in half the volume, and **the total quantity of material available is identical either way**.`,
      ],
      table: {
        caption: "A 10 mg solute made up in different volumes of diluent",
        columns: ["Diluent added", "Concentration", "Volume containing 1 mg"],
        rows: [
          ["1 ml", `${at1ml} mg/ml`, `${(1 / at1ml).toFixed(2)} ml`],
          ["2 ml", `${at2ml} mg/ml`, `${(1 / at2ml).toFixed(2)} ml`],
          ["5 ml", `${at5ml} mg/ml`, `${(1 / at5ml).toFixed(2)} ml`],
        ],
      },
    },
    {
      heading: "Which units is concentration expressed in?",
      paragraphs: [
        `Milligrams per millilitre is the usual working unit, and it is the one to standardise on because it makes the division direct. Ten milligrams in two millilitres is five milligrams per millilitre, with no conversion in between.`,
        `Micrograms per millilitre appears where the masses are small, and the only trap is the factor of a thousand between them. One milligram per millilitre is one thousand micrograms per millilitre, and mixing the two units in the same calculation is the most common arithmetic error in this area.`,
        `Percentage strength turns up on some labels. A one per cent solution is one gram in one hundred millilitres, which is ten milligrams per millilitre. Converting to milligrams per millilitre before doing anything else avoids carrying two systems through the same sum.`,
      ],
      list: [
        "1 mg/ml equals 1000 micrograms/ml",
        "1 per cent equals 10 mg/ml",
        "0.9 per cent equals 9 mg/ml, which is where the 0.9 in saline comes from",
      ],
    },
    {
      heading: "How do you work backwards from a target concentration?",
      paragraphs: [
        `Divide the mass by the concentration you want, and the answer is [the volume of diluent to add](/calculator). Twenty milligrams at a target of four milligrams per millilitre needs five millilitres. The same division, rearranged.`,
        `Sense-check the answer against the container before adding anything. A calculated volume larger than the container will hold is a sign the target concentration is wrong for the quantity of material, not a reason to fill to the brim and hope.`,
        `Check it against the vial too. [A ${vial} ml vial of diluent](/#buy) supports ${preparationsPerVial} preparations at two millilitres each, so a target that needs large volumes per preparation changes how many vials the work requires.`,
      ],
    },
    {
      heading: "Does the solid add to the volume?",
      paragraphs: [
        `Slightly, and for most laboratory work the effect is small enough to ignore. A few milligrams of solid dissolving into a millilitre or more of liquid displaces very little, so the final volume is close to the volume of diluent added.`,
        `Where precision matters the distinction is between making up **to** a volume and adding a volume. Making up to a volume means the total ends at the stated figure including the solid. Adding a volume means the diluent is measured and the total is slightly more. In a vial, adding is what happens, because there is no graduation to make up to.`,
        `If a supplier's documentation specifies one or the other, follow it. If it does not, adding a measured volume of diluent is the normal reading, and the difference is not usually the largest source of error in the sequence.`,
      ],
    },
    {
      heading: "Where does the error usually come from?",
      paragraphs: [
        `Measuring the diluent, not the arithmetic. A syringe read at the wrong point on the scale, or read past the plunger tip rather than at it, puts a percentage error into every calculation downstream of it that no amount of careful division recovers.`,
        `The second source is dead volume. Liquid held in the syringe hub and the needle bore is drawn up but never transferred, so slightly less diluent reaches the container than the scale suggested. It is a few hundredths of a millilitre per transfer, which **matters at small volumes and disappears at large ones**.`,
        `The third is unit confusion, almost always the thousand between milligrams and micrograms. Writing the units at every step, rather than carrying bare numbers, is what catches it.`,
      ],
    },
    {
      heading: "How much diluent does a run of work need?",
      paragraphs: [
        `Multiply the volume per preparation by the number of preparations, then check the answer against the in-use limit rather than against the vial size alone. A ${vial} ml vial covers ${preparationsPerVial} preparations at two millilitres, but only those made within ${FACTS.openedLimit}.`,
        `Work spread over a longer period is limited by the calendar rather than the volume. A vial entered once a week reaches day ${FACTS.openedLimitDays} with most of its contents unused, so [the number of vials needed follows the schedule](/guides/how-many-draws-from-a-vial), not the total volume.`,
        `Planning both together is the point. The volume tells you how many preparations a vial can supply; the in-use limit tells you how many of those you will actually reach before the vial has to be discarded.`,
      ],
    },
  ],
  faq: [
    {
      q: "How do I calculate concentration after adding diluent?",
      a: `Divide the mass of solute by the volume of diluent added. Ten milligrams made up in two millilitres gives ${at2ml} milligrams per millilitre.`,
    },
    {
      q: "How much diluent do I add for a target concentration?",
      a: "Divide the mass by the target concentration. Twenty milligrams at four milligrams per millilitre needs five millilitres of diluent.",
    },
    {
      q: "Does adding more diluent reduce the total amount of material?",
      a: "No. The mass is unchanged. More diluent spreads the same mass through a larger volume, so the concentration falls while the total quantity available stays the same.",
    },
    {
      q: "How many micrograms are in a milligram per millilitre?",
      a: "One thousand. A solution at one milligram per millilitre is one thousand micrograms per millilitre, and mixing the two units in one calculation is the usual source of error.",
    },
    {
      q: `How many preparations does a ${vial} ml vial support?`,
      a: `${preparationsPerVial} at two millilitres each, or ${vial} at one millilitre, less a little lost to syringe dead volume. The in-use limit of ${FACTS.openedLimit} applies as well, so a slow schedule may not reach the full count.`,
    },
  ],
  related: ["how-many-draws-from-a-vial", "bacteriostatic-water-vs-saline"],
};
