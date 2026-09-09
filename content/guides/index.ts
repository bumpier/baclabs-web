import type { Guide } from "@/content/guides/types";
import { whatIsBacteriostaticWater } from "@/content/guides/what-is-bacteriostatic-water";
import { bacteriostaticVsSterileWater } from "@/content/guides/bacteriostatic-water-vs-sterile-water";
import { howLongDoesItLast } from "@/content/guides/how-long-does-bacteriostatic-water-last";
import { howToStore } from "@/content/guides/how-to-store-bacteriostatic-water";
import { whereToBuyUk } from "@/content/guides/where-to-buy-bacteriostatic-water-uk";
import { vialSizes } from "@/content/guides/bacteriostatic-water-vial-sizes";
import { howManyDrawsFromAVial } from "@/content/guides/how-many-draws-from-a-vial";
import { isBacteriostaticWaterAMedicineUk } from "@/content/guides/is-bacteriostatic-water-a-medicine-uk";
import { bacteriostaticWaterVsSaline } from "@/content/guides/bacteriostatic-water-vs-saline";
import { whatMultiDoseMeans } from "@/content/guides/what-multi-dose-means";
import { howToReadAVialLabel } from "@/content/guides/how-to-read-a-vial-label";
import { vialHandlingAndContamination } from "@/content/guides/vial-handling-and-contamination";
import { diluentVolumeAndConcentration } from "@/content/guides/diluent-volume-and-concentration";

/** Every published guide, in the order the index page lists them. */
export const GUIDES: readonly Guide[] = [
  whatIsBacteriostaticWater,
  bacteriostaticVsSterileWater,
  bacteriostaticWaterVsSaline,
  whatMultiDoseMeans,
  howLongDoesItLast,
  howToStore,
  howManyDrawsFromAVial,
  diluentVolumeAndConcentration,
  howToReadAVialLabel,
  vialHandlingAndContamination,
  vialSizes,
  whereToBuyUk,
  isBacteriostaticWaterAMedicineUk,
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
