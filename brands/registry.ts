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
import { beautyProfile } from "./beauty/profile";
import { gymProfile } from "./gym/profile";
import { wholesaleProfile } from "./wholesale/profile";
import { luxuryProfile } from "./luxury/profile";
import { BRAND_IDS, DEFAULT_BRAND, type BrandId, type BrandProfile } from "./types";

export { BRAND_IDS, DEFAULT_BRAND } from "./types";
export type { BrandId, BrandProfile } from "./types";

const PROFILES: Record<BrandId, () => BrandProfile> = {
  baclab: baclabProfile,
  beauty: beautyProfile,
  gym: gymProfile,
  wholesale: wholesaleProfile,
  luxury: luxuryProfile,
};

/**
 * Fixture brands registered by test scripts (__registerTestBrand). Empty in
 * the app. Kept apart from PROFILES so BRAND_IDS and isBrandId() only ever
 * describe real brands.
 */
const TEST_PROFILES = new Map<string, () => BrandProfile>();

/**
 * TESTS ONLY (scripts/): register a fixture brand, so the code paths for a
 * second brand can be exercised without registering a real one. brandFor(),
 * brandFromHost() and allBrands() then know it; BRAND_IDS and isBrandId() do
 * not. Refuses to run in production.
 */
export function __registerTestBrand(profile: Omit<BrandProfile, "id"> & { id: string }): BrandProfile {
  if (process.env.NODE_ENV === "production") throw new Error("__registerTestBrand is for test scripts only");
  if (isBrandId(profile.id)) throw new Error(`"${profile.id}" is a real brand`);
  // The id is a fixture's, not a BrandId: the cast is the point of the fixture.
  const fixture = profile as BrandProfile;
  TEST_PROFILES.set(profile.id, () => fixture);
  return fixture;
}

export function isBrandId(value: unknown): value is BrandId {
  return typeof value === "string" && (BRAND_IDS as readonly string[]).includes(value);
}

/** The profile for a stored brand id. Anything unrecognised is BacLab. */
export function brandFor(id: string | null | undefined): BrandProfile {
  if (isBrandId(id)) return PROFILES[id]();
  const fixture = id ? TEST_PROFILES.get(id) : undefined;
  return fixture ? fixture() : PROFILES[DEFAULT_BRAND]();
}

/** Every registered brand, BacLab first (then any test fixtures). */
export function allBrands(): BrandProfile[] {
  return [...BRAND_IDS.map((id) => PROFILES[id]()), ...[...TEST_PROFILES.values()].map((p) => p())];
}

/** `Host` header value -> brand. Port and case are ignored; unknown hosts are BacLab. */
export function brandFromHost(host: string | null | undefined): BrandProfile {
  const name = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  // Typed as string so the comparison doesn't narrow `id` to never while
  // BacLab is the only registered brand.
  const fallback: string = DEFAULT_BRAND;
  if (name) {
    for (const profile of allBrands()) {
      if (profile.id === fallback) continue;
      if (profile.domains.includes(name)) return profile;
    }
  }
  return brandFor(DEFAULT_BRAND);
}

/**
 * Whether a row (an order, say) belongs to the brand whose site the request
 * came from. Public routes that look a row up by id check this, so one
 * brand's site can never show another brand's order: it answers as if the
 * row did not exist. A row written before brands existed is BacLab's, and
 * so is an unknown host, as everywhere else.
 */
export function belongsToHost(rowBrand: string | null | undefined, host: string | null | undefined): boolean {
  return brandFor(rowBrand).id === brandFromHost(host).id;
}
