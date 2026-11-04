import localFont from "next/font/local";

// Brute Lab's three faces, self-hosted from brands/gym/fonts/ for the same
// reason as app/fonts.ts: the CSP sets `font-src 'self'`, and next/font/google
// once failed a deploy by fetching from Google during `next build`. The files
// are the latin variable subsets published by Fontsource (@fontsource-variable,
// 5.3.0, from cdn.jsdelivr.net). Glyphs outside latin fall back to the system
// face. The variables go on <html> in app/gym/layout.tsx, so the @theme in
// brands/gym/styles.css can read them.
//
// THREE FACES, THREE JOBS.
//
// Big Shoulders (SIL Open Font License 1.1; The Big Shoulders Project
// Authors) is the display face: a condensed industrial grotesque drawn for
// Chicago's city signage, heavy to 900, with an optical-size axis that
// tightens it at poster sizes. Uppercase, it is the gym's voice.
//
// Big Shoulders Stencil (SIL Open Font License 1.1; same authors) sets the
// figures: prices, vial counts and the plate stamps. The stencil bridges are
// the crate-and-plate marking a lifter already reads at a glance.
//
// Archivo (SIL Open Font License 1.1; The Archivo Project Authors) is the
// body: a sturdy grotesque made for both print and screen, which stays
// readable at 15px on black, where a condensed face would not.

export const displayFont = localFont({
  src: "./fonts/big-shoulders-latin-standard-normal.woff2",
  variable: "--font-gym-display",
  display: "swap",
  weight: "100 900",
});

export const stencilFont = localFont({
  src: "./fonts/big-shoulders-stencil-latin-standard-normal.woff2",
  variable: "--font-gym-stencil",
  display: "swap",
  weight: "100 900",
});

export const bodyFont = localFont({
  src: "./fonts/archivo-latin-wght-normal.woff2",
  variable: "--font-gym-body",
  display: "swap",
  weight: "100 900",
});
