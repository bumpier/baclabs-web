import { Inter, Schibsted_Grotesk } from "next/font/google";

// next/font requires literal font names, so font swaps for a white-label
// happen here (one import) rather than in config/brand.ts. It also self-hosts
// at build time, which matters: the CSP in next.config.js sets
// `font-src 'self'`, so a Google Fonts <link> or any external host is blocked.
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

export const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const displayFont = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  // 500 for section headings, 700 for the hero and the big-number moment.
  weight: ["500", "700", "800"],
});
