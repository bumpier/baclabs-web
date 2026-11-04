import localFont from "next/font/local";

// Reserve No.10's two faces, self-hosted from brands/luxury/fonts/ for the
// same reason as app/fonts.ts: the CSP sets `font-src 'self'`, and
// next/font/google once failed a deploy by fetching at build time. These are
// the fontsource packages' latin variable files (v5.3.0, from jsDelivr),
// each under the SIL Open Font License 1.1, whose text sits beside it.
// Glyphs outside latin fall back to the system face.
//
// BODONI MODA (indestructible type, OFL 1.1) is the display face: a Didone
// with an optical-size axis (6 to 96). The browser picks the cut from the
// font size (font-optical-sizing is auto), so the hero gets the hairline
// display cut and a price or a line in a table gets the sturdier text cut,
// from one file.
//
// JOST (indestructible type, OFL 1.1) is the text face: a geometric sans in
// the Futura line, the classic partner to a Didone in print. It sets the
// body, the forms and the figures, and keeps out of the serif's way.

export const displayFace = localFont({
  src: "./fonts/bodoni-moda-latin.woff2",
  variable: "--font-rx-display",
  display: "swap",
  weight: "400 700",
  adjustFontFallback: "Times New Roman",
});

export const textFace = localFont({
  src: "./fonts/jost-latin.woff2",
  variable: "--font-rx-text",
  display: "swap",
  weight: "300 600",
});
