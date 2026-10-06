import localFont from "next/font/local";

// next/font requires literal font sources, so font swaps for a white-label
// happen here (one import) rather than in config/brand.ts. It self-hosts,
// which matters: the CSP in next.config.js sets `font-src 'self'`, so a
// Google Fonts <link> or any external host is blocked.
//
// THE FILES ARE IN THE REPO (assets/fonts), not fetched from Google at build
// time. next/font/google downloads them during `next build`, and on 6 Oct 2026
// Google answered the VPS with a font URL next/font could not parse, failing
// the deploy. These are the same latin variable files it was downloading
// (Inter v20, Schibsted Grotesk v7), both under the SIL Open Font License 1.1.
// Glyphs outside latin fall back to the system face, as before.
//
// TWO FACES, WITH DIFFERENT JOBS.
//
// Schibsted Grotesk is the display face. Not a serif: this is lab supply, and
// a warm high-contrast serif reads as wellness. Schibsted is a Nordic
// grotesque with flat sides and a very heavy top end (up to 900) — it holds
// its nerve at 96px, which is what the hero asks of it. Tight negative
// tracking at display sizes does the rest.
//
// Inter stays as the body and — more importantly — the DATA face. It carries
// `tnum` (tabular figures) and `zero` (slashed zero) as OpenType features,
// which is the authentic technical signal on a page that sells by volume and
// price per millilitre. There is deliberately no third face for data, and no
// monospace. See .tabular in app/globals.css.

export const bodyFont = localFont({
  src: "../assets/fonts/inter-latin.woff2",
  variable: "--font-body",
  display: "swap",
  // The weights the site uses. The file is variable (100–900); the range
  // keeps a stray bold at 600, as the Google import did.
  weight: "400 600",
});

export const displayFont = localFont({
  src: "../assets/fonts/schibsted-grotesk-latin.woff2",
  variable: "--font-display-face",
  display: "swap",
  // 500 for section headings, 700 for the hero and the big-number moment.
  weight: "500 800",
});
