"use client";

import { useTrackersFor, type ConfiguredTrackers } from "@/components/consent/consent-core";

/**
 * Tracking consent — the browser half. One store, read by the analytics tags,
 * the banner and the "Cookie settings" links, so they can never disagree.
 *
 * The store itself is consent-core.ts, shared with the brands' storefronts.
 * This file adds the one thing that is BacLab's alone: its GA4 id, inlined at
 * build time. A brand's bundle never imports this file, so it never carries
 * that id.
 */
export {
  hasTrackingConsent,
  openConsentSettings,
  setConsent,
  useConsent,
  useConsentSettingsOpen,
  type ConfiguredTrackers,
} from "@/components/consent/consent-core";

// ── What is there to consent to? ───────────────────────────────────

/** GA4 is inlined at build time (see components/Analytics.tsx). */
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

/**
 * Null until known. The Meta Pixel is a runtime setting, so it takes one
 * request to find out; GA4 is known immediately.
 */
export function useConfiguredTrackers(): ConfiguredTrackers | null {
  return useTrackersFor(Boolean(GA4_ID));
}
