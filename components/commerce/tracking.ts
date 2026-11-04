"use client";

import { useTrackersFor, type ConfiguredTrackers } from "@/components/consent/consent-core";

/**
 * Which trackers a brand's site runs, for its cookie banner, its "Cookie
 * settings" link, its signup popup and its analytics tags, so they can never
 * disagree.
 *
 *  - GA4: the brand's own property id, from its profile (storefrontView's
 *    `tracking.ga4Id`), passed in as a prop. Never BacLab's build-time
 *    NEXT_PUBLIC_GA4_ID: that stays in consent-store.ts, which no brand
 *    imports.
 *  - Meta: a runtime setting, resolved per request for the Host's own brand
 *    (/api/tracking and /api/pixel, the same choice the server-side Purchase
 *    makes). `metaPixel: false` turns it off for a site whatever is set.
 */

export interface TrackingConfig {
  ga4Id?: string | null;
  metaPixel?: boolean;
}

/** A GA4 measurement id, or null. It is written into an inline script, so nothing else passes. */
export function validGa4Id(id: string | null | undefined): string | null {
  const value = id?.trim() ?? "";
  return /^G-[A-Z0-9]{4,20}$/.test(value) ? value : null;
}

/** Null until the Meta answer is in. */
export function useBrandTrackers(config: TrackingConfig): ConfiguredTrackers | null {
  const trackers = useTrackersFor(validGa4Id(config.ga4Id) !== null);
  if (!trackers) return null;
  return { ga4: trackers.ga4, metaPixel: config.metaPixel !== false && trackers.metaPixel };
}

/** Whether there is anything to ask consent for. */
export function anyTracker(trackers: ConfiguredTrackers | null): boolean {
  return Boolean(trackers && (trackers.metaPixel || trackers.ga4));
}
