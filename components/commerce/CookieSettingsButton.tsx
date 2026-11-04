"use client";

import type { ReactNode } from "react";
import { openConsentSettings } from "@/components/consent/consent-core";
import { anyTracker, useBrandTrackers, type TrackingConfig } from "@/components/commerce/tracking";

/**
 * Reopens a brand's cookie banner, so a visitor can withdraw or give consent
 * as easily as they gave it (PECR). Renders nothing when the site runs no
 * tracker. `asListItem` wraps it in an <li>, so a list never carries an empty
 * item when it renders nothing.
 */
export function CookieSettingsButton({
  ga4Id,
  metaPixel,
  className,
  asListItem = false,
  children = "Cookie settings",
}: TrackingConfig & { className?: string; asListItem?: boolean; children?: ReactNode }) {
  const trackers = useBrandTrackers({ ga4Id, metaPixel });
  if (!anyTracker(trackers)) return null;

  const button = (
    <button type="button" className={className} onClick={openConsentSettings}>
      {children}
    </button>
  );
  return asListItem ? <li>{button}</li> : button;
}
