"use client";

import { useEffect, useRef } from "react";
import { brand } from "@/config/brand";

/**
 * Trustpilot TrustBox widget. The bootstrap script is loaded once, on first
 * render of any TrustBox, and each box is initialised with loadFromElement so
 * it also works after client-side navigation (the snippet Trustpilot hands out
 * only scans the page once, at script load).
 *
 * Template ids are Trustpilot's public widget templates. Only free-plan
 * widgets are listed; a paid one renders blank on this account.
 */
export const TRUSTBOX_TEMPLATES = {
  /** "Review us on Trustpilot" button. Shows no score, so safe at 0 reviews. */
  reviewCollector: "56278e9abfbbba0bdcd568bc",
  /** Stars, TrustScore and review count on one line. */
  microCombo: "5419b6ffb0d04a076446a9af",
  /** Logo, stars, TrustScore and review count, stacked. */
  mini: "53aa8807dec7e10d38f59f32",
} as const;

type Template = keyof typeof TRUSTBOX_TEMPLATES;

const SCRIPT_SRC = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";

declare global {
  interface Window {
    Trustpilot?: { loadFromElement: (el: HTMLElement, forceReload?: boolean) => void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Trustpilot) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        // Let a later mount retry rather than caching the failure.
        scriptPromise = null;
        reject(new Error("Trustpilot widget script failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function TrustBox({
  template,
  height,
  width = "100%",
  theme = "light",
  className,
}: {
  template: Template;
  /** Must match the template's designed height, or the iframe clips. */
  height: string;
  width?: string;
  theme?: "light" | "dark";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { businessUnitId, profileUrl } = brand.trustpilot;

  useEffect(() => {
    const el = ref.current;
    if (!el || !businessUnitId) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (!cancelled && window.Trustpilot) window.Trustpilot.loadFromElement(el, true);
      })
      .catch(() => {
        // Blocked by an extension or offline: the fallback link stays visible.
      });
    return () => {
      cancelled = true;
    };
  }, [businessUnitId, template]);

  if (!businessUnitId) return null;

  return (
    <div
      ref={ref}
      className={`trustpilot-widget${className ? ` ${className}` : ""}`}
      data-locale="en-GB"
      data-template-id={TRUSTBOX_TEMPLATES[template]}
      data-businessunit-id={businessUnitId}
      data-style-height={height}
      data-style-width={width}
      data-theme={theme}
    >
      {/* Replaced by the iframe once the script runs. */}
      <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="link text-sm">
        Trustpilot
      </a>
    </div>
  );
}
