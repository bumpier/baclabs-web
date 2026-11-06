import localFont from "next/font/local";

// GymWater's two families, self-hosted from brands/gym/fonts/ for the same
// reason as app/fonts.ts: the CSP sets `font-src 'self'`, and next/font/google
// once failed a deploy by fetching from Google during `next build`. Both are
// the latin variable subsets published by Fontsource (@fontsource-variable,
// from cdn.jsdelivr.net). Glyphs outside latin fall back to the system face.
// The variables go on <html> in app/gym/layout.tsx, so the @theme in
// brands/gym/styles.css can read them.
//
// Archivo (SIL Open Font License 1.1; The Archivo Project Authors), with both
// of its axes: weight 100 to 900 and width 62 to 125. One file does two jobs.
// At full width and 800 to 900 it is the brand's voice: the wide, heavy
// grotesque a sports label is set in, for every heading and the hero. At
// normal width it is the body, sturdy and readable at 15px on black.
//
// Big Shoulders Stencil (SIL Open Font License 1.1; The Big Shoulders Project
// Authors) sets the counts and the prices: the stencilled figures stamped on
// the box, the brand's own numerals.
//
// The OG image (app/gym/og/route.tsx) cannot read woff2 or a variable font,
// so it reads two static .woff cuts of the same families from fonts/og/,
// on the server only. The browser never loads them.

export const bodyFont = localFont({
  src: "./fonts/archivo-latin-standard-normal.woff2",
  variable: "--font-gym-body",
  display: "swap",
  weight: "100 900",
  // The width axis, so CSS can ask for `font-stretch: 125%`.
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

export const stencilFont = localFont({
  src: "./fonts/big-shoulders-stencil-latin-standard-normal.woff2",
  variable: "--font-gym-stencil",
  display: "swap",
  weight: "100 900",
});
