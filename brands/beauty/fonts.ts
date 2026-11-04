import localFont from "next/font/local";

// Aurelle's two faces, self-hosted from this folder, as app/fonts.ts does for
// BacLab: the CSP sets `font-src 'self'`, and next/font/google once failed a
// deploy by fetching at build time. Both are the latin subsets from the
// fontsource packages, as woff2.
//
// Rosarivo (Pablo Ugerman), SIL Open Font License 1.1. The display face: a
// soft, calligraphic serif with round bowls and old-style figures, refined
// without the hard contrast of a Didone. One weight, 400, used only at
// display sizes (headings, set names, prices).
//
// Ysabeau Office (Christian Thalmann), SIL Open Font License 1.1. The text
// face: a humanist sans drawn from Garamond's skeleton, so it sits beside the
// serif without competing; the Office cut has lining figures for prices and
// counts. Variable, used from 400 to 650.

export const displayFont = localFont({
  src: "./fonts/rosarivo-latin-400-normal.woff2",
  variable: "--font-aurelle-display",
  display: "swap",
  weight: "400",
});

export const textFont = localFont({
  src: "./fonts/ysabeau-office-latin-wght-normal.woff2",
  variable: "--font-aurelle-text",
  display: "swap",
  weight: "300 700",
});
