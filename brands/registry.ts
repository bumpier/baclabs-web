/**
 * The brand registry: id -> profile, and host -> brand.
 *
 * SERVER CODE ONLY. It holds every brand's profile, so a client component
 * that imported it would ship every brand's name in one brand's JavaScript.
 * Client components take their own brand's data as props instead.
 *
 * Unknown hosts and unknown ids resolve to BacLab, which is how the app
 * behaved before brands existed: BacLab's mirror domains keep working, and a
 * row written before the brand column existed reads as BacLab.
 */
import { baclabProfile } from "./baclab/profile";
import { BRAND_IDS, DEFAULT_BRAND, type BrandId, type BrandProfile } from "./types";

export { BRAND_IDS, DEFAULT_BRAND } from "./types";
export type { BrandId, BrandProfile } from "./types";

const PROFILES: Record<BrandId, () => BrandProfile> = {
  baclab: baclabProfile,
};

export function isBrandId(value: unknown): value is BrandId {
  return typeof value === "string" && (BRAND_IDS as readonly string[]).includes(value);
}

/** The profile for a stored brand id. Anything unrecognised is BacLab. */
export function brandFor(id: string | null | undefined): BrandProfile {
  return PROFILES[isBrandId(id) ? id : DEFAULT_BRAND]();
}

/** Every registered brand, BacLab first. */
export function allBrands(): BrandProfile[] {
  return BRAND_IDS.map((id) => PROFILES[id]());
}

/** `Host` header value -> brand. Port and case are ignored; unknown hosts are BacLab. */
export function brandFromHost(host: string | null | undefined): BrandProfile {
  const name = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  // Typed as string so the comparison doesn't narrow `id` to never while
  // BacLab is the only registered brand.
  const fallback: string = DEFAULT_BRAND;
  if (name) {
    for (const id of BRAND_IDS) {
      if (id === fallback) continue;
      const profile = PROFILES[id]();
      if (profile.domains.includes(name)) return profile;
    }
  }
  return brandFor(DEFAULT_BRAND);
}
