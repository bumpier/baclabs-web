"use client";

import { openConsentSettings, useConfiguredTrackers } from "@/components/consent/consent-store";

/**
 * Reopens the cookie banner so a visitor can withdraw or give consent. PECR
 * requires withdrawal to be as easy as giving it.
 *
 * Renders nothing when no tracker is configured. `asListItem` wraps it in an
 * <li> so a list never carries an empty item when it renders nothing.
 */
export function CookieSettingsButton({
  className,
  asListItem = false,
  children = "Cookie settings",
}: {
  className?: string;
  asListItem?: boolean;
  children?: React.ReactNode;
}) {
  const trackers = useConfiguredTrackers();
  if (!trackers || !(trackers.metaPixel || trackers.ga4)) return null;

  const button = (
    <button type="button" className={className} onClick={openConsentSettings}>
      {children}
    </button>
  );
  return asListItem ? <li>{button}</li> : button;
}
