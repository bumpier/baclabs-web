"use client";

import { useEffect, useRef } from "react";

/**
 * Opens the print dialog once the page has settled. It waits for the load
 * event so the slip logo is in, and for fonts because postage labels re-fit
 * their text when Inter arrives. Render it after the labels: their fit
 * callbacks are queued on the same fonts promise first, so they run first.
 */
export function AutoPrint() {
  const printed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) =>
            window.addEventListener("load", () => resolve(), { once: true })
          );
    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.all([fonts, loaded]).then(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
