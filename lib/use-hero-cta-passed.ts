"use client";

import { useEffect, useState } from "react";

/**
 * The hero's primary call to action, as an id.
 *
 * Two separate components need to know whether it is still on screen — the
 * header's compact CTA and the mobile buy bar — because both exist only to
 * stand in for it once it is gone. Neither should appear while the real
 * button is still visible: a floating button covering the button it points
 * at is a dark pattern, not a convenience.
 */
export const HERO_CTA_ID = "hero-cta";

/**
 * True once the hero CTA has left the viewport.
 *
 * This used to be `window.scrollY > 520` in two places. The number was wrong
 * on every viewport it was not measured on: at 390×844 the hero CTA's bottom
 * sits at 661px, so both stand-ins appeared roughly 100px of scroll BEFORE
 * the button they replace had gone, and the error moved with screen height,
 * font size and browser chrome.
 *
 * An observer asks the question directly and costs one callback per crossing
 * instead of a scroll listener and a rAF per frame — and one observer now
 * serves both components instead of two listeners computing the same boolean.
 *
 * On a page with no hero CTA (the legal and contact pages), there is nothing
 * to defer to, so the stand-in is available immediately.
 */
export function useHeroCtaPassed(): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const target = document.getElementById(HERO_CTA_ID);
    if (!target) {
      setPassed(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setPassed(!entry.isIntersecting));
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return passed;
}
