import { PRODUCT, VIAL_ML } from "@/config/funnel";

/**
 * THE canonical facts every guide, FAQ answer, data table and schema block
 * must quote. A guide that types "28 days" by hand can drift from the product
 * page; one that reads FACTS.openedLimit cannot.
 *
 * The preservative is deliberately never named or quantified anywhere on the
 * site: the specific chemical name and concentration trip advertising-platform
 * filters. Say "a bacteriostatic preservative" and no more.
 *
 * Nothing here may state or imply a therapeutic use — the same rule as
 * config/funnel.ts and /disclaimer. These are chemistry and handling facts
 * about a laboratory diluent, and that is all they may ever be.
 */
export const FACTS = {
  /** In-use limit once the stopper has been punctured. From the label. */
  openedLimit: PRODUCT.shelfLifeAfterOpening || "28 days from first puncture",
  openedLimitDays: 28,
  vialMl: VIAL_ML,
  /** CAS registry number for water. A reference value, not product-specific. */
  casWater: "7732-18-5",
  /** EC (EINECS) number for water. */
  ecWater: "231-791-2",
  formulaWater: "H₂O",
  /** Water, g/mol. */
  molecularWeightWater: "18.015",
  /** True by definition of the product; not a label claim. */
  appearance: "Clear, colourless liquid, free of visible particles",
  /**
   * The preservative is present below the generic concentration limits at
   * which a mixture inherits its components' classifications, so the mixture
   * is not classified.
   */
  hazardClassification: "Not classified as hazardous under the GB CLP Regulation",
  /** The synonyms people search for. Stated once, visibly, on the product page. */
  synonyms: ["bac water", "bacteriostatic mixing water", "mixing water", "BAC water"],
} as const;

/**
 * Who signs the guides. An Organization rather than a Person until a named
 * author with a public profile is supplied — schema.org accepts either, and
 * a real organisation beats an invented name.
 */
export const GUIDE_AUTHOR = { type: "Organization" as const };
