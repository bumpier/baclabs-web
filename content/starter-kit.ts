import { LAB_KIT, PRODUCT, SINGLE_BUNDLE, STARTER_KIT, VIAL_ML, formatMinor, kitPriceMinor, KIT_PRICES, labKitContents } from "@/config/funnel";
import { FACTS } from "@/content/facts";

/**
 * The copy on the Starter Kit's landing page (app/(store)/starter-kit),
 * kept as data so scripts/test-order-pricing.ts can run it through the
 * content rules (lib/content-rules.ts) like a guide. Every figure is read
 * from config, never typed.
 *
 * "Insulin needle" is the supplier's name for the part, and the only place
 * the word may appear (Liam, 26 Oct 2026). Nothing here describes what the
 * water or the pieces are used on: they are lab consumables.
 */

/** What each part is, in a line. Keyed by LAB_KIT part SKU. */
const PART_NOTES: Record<string, string> = {
  "baclab-kit-syringe": "Single-use and individually wrapped.",
  "baclab-kit-long-needle": "Longer needles for drawing from the vial through its stopper.",
  "baclab-kit-insulin-needle": "Fine needles, single-use and individually wrapped.",
  "baclab-kit-alcohol-swab": "Individually wrapped, for wiping the vial's stopper.",
};

const separately = SINGLE_BUNDLE.priceMinor + kitPriceMinor(SINGLE_BUNDLE);
const kitFrom = Math.min(...Object.values(KIT_PRICES));

export const STARTER_KIT_COPY = {
  metaTitle: `${STARTER_KIT.name}: ${VIAL_ML}ml ${PRODUCT.name} with a ${LAB_KIT.name}`,
  metaDescription: `One ${VIAL_ML}ml vial of ${PRODUCT.name.toLowerCase()} with a ${LAB_KIT.name} of ${labKitContents()}, for ${formatMinor(STARTER_KIT.priceMinor)}. Sterile and individually wrapped.`,
  eyebrow: `One vial, one ${LAB_KIT.name}`,
  h1: STARTER_KIT.name,
  lede: `One ${VIAL_ML}ml vial of ${PRODUCT.name.toLowerCase()} and a ${LAB_KIT.name} to go with it: ${labKitContents()}. The kit's pieces are sterile, single-use and individually wrapped.`,

  boxHeading: "What's in the box",
  box: [
    { count: 1, name: `${VIAL_ML}ml vial of ${PRODUCT.name.toLowerCase()}`, note: PRODUCT.composition },
    ...LAB_KIT.parts.map((p) => ({
      count: p.perKit,
      name: `${p.name.toLowerCase()}s`,
      note: PART_NOTES[p.sku] ?? "Single-use and individually wrapped.",
    })),
  ],
  disposal: "Single-use. Dispose of used needles in a sharps container.",

  saveHeading: "Why buy it as a kit",
  save: `Bought separately, the vial is ${formatMinor(SINGLE_BUNDLE.priceMinor)} and a ${LAB_KIT.name} with it is ${formatMinor(kitPriceMinor(SINGLE_BUNDLE))}: ${formatMinor(separately)} in all. The ${STARTER_KIT.name} is ${formatMinor(STARTER_KIT.priceMinor)}, so you save ${formatMinor(separately - STARTER_KIT.priceMinor)}.`,

  vialHeading: "About the vial",
  vial: `${PRODUCT.use} Store it unopened at ${PRODUCT.storageUnopened}. Once opened it keeps for ${FACTS.openedLimit}, stored at ${PRODUCT.storageOpened}.`,

  moreHeading: "Need more than one vial?",
  more: `A ${LAB_KIT.name} holds the pieces for one vial. Our packs of 5 to 100 vials can add a ${LAB_KIT.name} for every vial, from ${formatMinor(kitFrom)} a kit.`,
  moreLink: "See the packs",
};
