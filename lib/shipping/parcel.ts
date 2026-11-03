/**
 * A parcel as the service picker sees it: grams and millimetres, integers.
 *
 * Zero in a dimension means "not measured". That is deliberately not the
 * same as small: a parcel of unknown size fits no service with a size limit,
 * so an unmeasured SKU is refused a service rather than handed the smallest.
 */
export interface Parcel {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export function hasDimensions(p: Parcel): boolean {
  return p.lengthMm > 0 && p.widthMm > 0 && p.heightMm > 0;
}

/**
 * Sides longest first, so L is always the longest. Carriers define length
 * that way, and it lets a parcel be rotated to fit rather than rejected for
 * the way someone happened to measure it.
 */
export function sortedSides(p: Parcel): [number, number, number] {
  const [l, w, h] = [p.lengthMm, p.widthMm, p.heightMm].sort((a, b) => b - a);
  return [l!, w!, h!];
}

/**
 * Chargeable weight on a volumetric service: the greater of what it weighs
 * and what its volume says it weighs. L×W×H in cm ÷ divisor gives kg, which
 * in mm and grams is simply L×W×H ÷ divisor.
 */
export function chargeableGrams(p: Parcel, volumetricDivisor: number | null): number {
  if (!volumetricDivisor || !hasDimensions(p)) return p.weightGrams;
  const volumetric = Math.ceil((p.lengthMm * p.widthMm * p.heightMm) / volumetricDivisor);
  return Math.max(p.weightGrams, volumetric);
}

/**
 * The weight a label declares: the most the service takes, not what the
 * parcel weighs. Amazon Shipping must never be told less than a parcel
 * weighs, so every SKU had been set to the 2 kg maximum as a margin — and a
 * 10-pack with a free vial then added up to 4 kg (22 Oct 2026). Declaring
 * the service's maximum keeps the margin without it adding up; the packed
 * weight on the SKUs only decides whether the parcel fits the service.
 *
 * Never under what it weighs: a parcel heavier than the service (one picked
 * by hand) is declared at its own weight, for the carrier to refuse. A
 * service with no maximum, or a parcel not yet weighed, keeps the packed
 * weight, so "weight not set" still stops the label.
 */
export function declaredGrams(weightGrams: number, maxWeightGrams: number): number {
  if (weightGrams <= 0 || maxWeightGrams <= 0) return weightGrams;
  return Math.max(weightGrams, maxWeightGrams);
}

/**
 * Several units in one parcel. Weight adds up. Size is the box they make
 * stacked flat — each unit lying on its largest face, one on top of another —
 * which always contains them, so it can over-state the size but never
 * under-state it. That is the safe direction: a parcel bumped up a service
 * costs a little more, one that arrives oversized is surcharged or returned.
 *
 * Any unit of unknown size makes the whole parcel's size unknown.
 */
export function combineUnits(units: readonly { parcel: Parcel; quantity: number }[]): Parcel {
  let weightGrams = 0;
  let lengthMm = 0;
  let widthMm = 0;
  let heightMm = 0;
  let measured = true;

  for (const { parcel, quantity } of units) {
    if (quantity <= 0) continue;
    weightGrams += parcel.weightGrams * quantity;
    if (!hasDimensions(parcel)) {
      measured = false;
      continue;
    }
    const [l, w, h] = sortedSides(parcel);
    lengthMm = Math.max(lengthMm, l);
    widthMm = Math.max(widthMm, w);
    heightMm += h * quantity;
  }

  return measured
    ? { weightGrams, lengthMm, widthMm, heightMm }
    : { weightGrams, lengthMm: 0, widthMm: 0, heightMm: 0 };
}

export function formatDimensions(p: Parcel): string {
  if (!hasDimensions(p)) return "size not set";
  return `${p.lengthMm} × ${p.widthMm} × ${p.heightMm} mm`;
}

export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 2)} kg` : `${grams} g`;
}
