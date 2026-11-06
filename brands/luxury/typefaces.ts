import localFont from "next/font/local";

// LuxeVial's three faces, self-hosted from brands/luxury/fonts/ for the
// same reason as app/fonts.ts: the CSP sets `font-src 'self'`, and
// next/font/google once failed a deploy by fetching at build time. These are
// the fontsource packages' latin files (v5.3.0, from jsDelivr), each under
// the SIL Open Font License 1.1, whose text sits beside it. Glyphs outside
// latin fall back to the system face.
//
// LIBRE CASLON DISPLAY (Pablo Impallari, OFL 1.1) is the brand's voice: a
// Caslon cut for large sizes, the English letter of engravers and
// stationers. It sets the headlines, the product's name and the sizes, and
// its outlines are the wordmark and the seal (components/mark-paths.ts).
//
// LIBRE CASLON TEXT (Impallari, OFL 1.1), roman and italic, is the same
// letter cut for reading: the chapters' paragraphs and the quiet italic
// notes beside a choice.
//
// HANKEN GROTESK (Alfredo Marco Pradil, OFL 1.1), variable, is the counter:
// prices, buttons, forms, the bag and the footer's small capitals. A plain
// grotesque, so the Caslon keeps the voice.

export const displayFace = localFont({
  src: "./fonts/libre-caslon-display-latin-400.woff2",
  variable: "--font-lv-display",
  display: "swap",
  weight: "400",
  adjustFontFallback: "Times New Roman",
});

export const serifFace = localFont({
  src: [
    { path: "./fonts/libre-caslon-text-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/libre-caslon-text-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-lv-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const textFace = localFont({
  src: "./fonts/hanken-grotesk-latin-wght.woff2",
  variable: "--font-lv-text",
  display: "swap",
  weight: "300 700",
});
