import localFont from "next/font/local";

// Aurelle's two faces, self-hosted from this folder, as app/fonts.ts does for
// BacLab: the CSP sets `font-src 'self'`, and next/font/google once failed a
// deploy by fetching at build time. Both are the latin subsets from the
// fontsource packages, as woff2.
//
// Rosarivo (Pablo Ugerman), SIL Open Font License 1.1. The display face: a
// soft, calligraphic serif with round bowls and old-style figures, refined
// without the hard contrast of a Didone. One weight, 400, used only at
// display sizes (headings, set names, prices). Its italic is the editorial
// voice: the ritual's lines, captions, the order's thank-you. The wordmark
// is drawn from the same outlines (components/wordmark-paths.ts).
//
// Ysabeau Office (Christian Thalmann), SIL Open Font License 1.1. The text
// face: a humanist sans drawn from Garamond's skeleton, so it sits beside the
// serif without competing; the Office cut has lining figures for prices and
// counts. Variable, used from 400 to 650.

export const displayFont = localFont({
  src: [
    { path: "./fonts/rosarivo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/rosarivo-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-aurelle-display",
  display: "swap",
});

export const textFont = localFont({
  src: "./fonts/ysabeau-office-latin-wght-normal.woff2",
  variable: "--font-aurelle-text",
  display: "swap",
  weight: "300 700",
});
