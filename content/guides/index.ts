import type { Guide } from "@/content/guides/types";
import { whatIsBacteriostaticWater } from "@/content/guides/what-is-bacteriostatic-water";
import { bacteriostaticVsSterileWater } from "@/content/guides/bacteriostatic-water-vs-sterile-water";
import { howLongDoesItLast } from "@/content/guides/how-long-does-bacteriostatic-water-last";
import { howToStore } from "@/content/guides/how-to-store-bacteriostatic-water";
import { whereToBuyUk } from "@/content/guides/where-to-buy-bacteriostatic-water-uk";
import { vialSizes } from "@/content/guides/bacteriostatic-water-vial-sizes";
import { benzylAlcoholInBacteriostaticWater } from "@/content/guides/benzyl-alcohol-in-bacteriostatic-water";
import { howManyDrawsFromAVial } from "@/content/guides/how-many-draws-from-a-vial";
import { isBacteriostaticWaterAMedicineUk } from "@/content/guides/is-bacteriostatic-water-a-medicine-uk";

/** Every published guide, in the order the index page lists them. */
export const GUIDES: readonly Guide[] = [
  whatIsBacteriostaticWater,
  bacteriostaticVsSterileWater,
  benzylAlcoholInBacteriostaticWater,
  howLongDoesItLast,
  howToStore,
  howManyDrawsFromAVial,
  vialSizes,
  whereToBuyUk,
  isBacteriostaticWaterAMedicineUk,
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
