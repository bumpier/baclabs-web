import { PRODUCT, VIAL_ML } from "@/config/funnel";

/**
 * THE canonical facts every guide, FAQ answer, data table and schema block
 * must quote. A guide that types "0.9%" by hand can drift from the product
 * page; one that reads FACTS.benzylAlcoholPct cannot.
 *
 * Nothing here may state or imply a therapeutic use — the same rule as
 * config/funnel.ts and /disclaimer. These are chemistry and handling facts
 * about a laboratory diluent, and that is all they may ever be.
 */
export const FACTS = {
  /** Preservative concentration, weight/volume — the USP basis. */
  benzylAlcoholPct: "0.9% w/v",
  /** The same figure as a mass concentration. */
  benzylAlcoholMgPerMl: "9 mg/mL",
  /** Milligrams of benzyl alcohol in one vial, derived. */
  benzylAlcoholMgPerVial: VIAL_ML * 9,
  /** In-use limit once the stopper has been punctured. From the label. */
  openedLimit: PRODUCT.shelfLifeAfterOpening || "28 days from first puncture",
  openedLimitDays: 28,
  vialMl: VIAL_ML,
  /** CAS registry numbers. Reference values, not product-specific. */
  casWater: "7732-18-5",
  casBenzylAlcohol: "100-51-6",
  /** EC (EINECS) numbers. */
  ecWater: "231-791-2",
  ecBenzylAlcohol: "202-859-9",
  formulaWater: "H₂O",
  formulaBenzylAlcohol: "C₇H₈O",
  /** Water, g/mol. */
  molecularWeightWater: "18.015",
  /** Benzyl alcohol, g/mol. */
  molecularWeightBenzylAlcohol: "108.14",
  /** True by definition of the product; not a label claim. */
  appearance: "Clear, colourless liquid, free of visible particles",
  /**
   * Benzyl alcohol is classified (Acute Tox. 4 oral and inhalation, Eye
   * Irrit. 2), but the generic concentration limit for a mixture to inherit
   * those classifications is 1% for acute toxicity and 10% for eye irritation.
   * At 0.9% the mixture falls below both, so it is not classified.
   */
  hazardClassification:
    "Not classified as hazardous under the GB CLP Regulation at 0.9% benzyl alcohol",
  /** The synonyms people search for. Stated once, visibly, on the product page. */
  synonyms: ["bac water", "bacteriostatic mixing water", "mixing water", "BAC water"],
} as const;

/**
 * Who signs the guides. An Organization rather than a Person until a named
 * author with a public profile is supplied — schema.org accepts either, and
 * a real organisation beats an invented name.
 */
export const GUIDE_AUTHOR = { type: "Organization" as const };
