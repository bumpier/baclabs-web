/**
 * The colour system, emitted as CSS custom properties on <html>.
 *
 * Every pairing is measured. Ratios in the comments are computed, not
 * estimated. Re-check them if you change a value.
 *
 * ── TWO COLOURS, ON WHITE ───────────────────────────────────────────
 *
 *   primary    #0047FF   electric blue — CTAs, links, active states
 *   secondary  #00D1FF   cyan — GRAPHICS ONLY, never text on light
 *   ink        #0B1220   near-black slate
 *
 * Everything else is white, one neutral wash, and two greys. The page gets
 * its structure from a hairline grid and generous space rather than from
 * coloured panels, so colour only ever appears where something is
 * clickable or where the product itself is drawn.
 *
 * The earlier palette split "structure" and "action" across two hues. That
 * rule is deliberately retired: primary now carries both, which is what
 * keeps the page to two colours. Restraint comes from how RARELY primary
 * appears, not from reserving a second hue for it.
 *
 * ── The cyan rule ───────────────────────────────────────────────────
 * `--secondary` measures 1.82:1 on white. It is a FIELD and GRAPHIC colour
 * only — the liquid in the vial, a fill bar, an icon on a dark ground. It
 * must never carry text on a light background, and never be a border that
 * conveys state.
 */

// Tailwind v4 resolves opacity modifiers with color-mix(), so tokens are
// plain colour values rather than the "R G B" triplets v3 required.
const c = (hex: string): string => hex;

// ── Grounds ───────────────────────────────────────────────────────────
/** The page is white. The grid does the work a tint used to do. */
const PAPER = "#FFFFFF";
const SURFACE = "#FFFFFF";
/** The one neutral wash, for cards that need to separate from the page. */
const NEUTRAL = "#F8FAFC";

// ── Text ──────────────────────────────────────────────────────────────
/** 18.72:1 on white (AAA). */
const INK = "#0B1220";
/** Secondary text. 7.27:1 on white (AAA). */
const INK_SOFT = "#4B5675";

// ── Rules ─────────────────────────────────────────────────────────────
/** The background grid and hairline dividers. Decorative — not text, not state. */
const LINE = "#E2E8F0";
/** Borders on real UI controls (unselected radio, input). 3.15:1 (AA non-text). */
const LINE_STRONG = "#8592A8";

// ── Primary: the only colour that means anything ──────────────────────
/** White on it: 6.28:1. As a link on white: 6.28:1. Both AA. */
const PRIMARY = "#0047FF";
/** Hover. Darker, so contrast only improves: 9.11:1 with white. */
const PRIMARY_DEEP = "#0035C4";
/** Faint wash for a selected row. Never behind white text. */
const PRIMARY_TINT = "#EEF3FF";

// ── Secondary: graphics only ──────────────────────────────────────────
/** `ink` on it: 10.53:1. On the dark band as text: 10.77:1. On white: 1.82 — never text. */
const SECONDARY = "#00D1FF";
const SECONDARY_TINT = "#E6FAFF";

// ── The dark band ─────────────────────────────────────────────────────
/** White on it: 19.55:1. Cyan on it: 10.77:1. */
const ABYSS = "#050B1F";

// ── Warnings and errors ───────────────────────────────────────────────
// Red-magenta, so an error is never mistaken for a primary control. Backs the
// form-error style in globals.css and the `destructive` token.
/** 9.00:1 on its tint. */
const WARN = "#7A1740";
const WARN_LINE = "#C2437E";
const WARN_TINT = "#FDEAF1";

export function brandCssVariables(): Record<string, string> {
  return {
    // Grounds
    "--paper": c(PAPER),
    "--surface": c(SURFACE),
    "--neutral": c(NEUTRAL),
    // Text and rules
    "--ink": c(INK),
    "--ink-soft": c(INK_SOFT),
    "--line": c(LINE),
    "--line-strong": c(LINE_STRONG),
    // Primary — links, CTAs, active states. `brand` and `cta` are aliases so
    // the admin panel's existing vocabulary keeps resolving.
    "--brand": c(PRIMARY),
    "--brand-deep": c(PRIMARY_DEEP),
    "--brand-soft": c(SECONDARY_TINT),
    "--brand-tint": c(PRIMARY_TINT),
    "--cta": c(PRIMARY),
    "--cta-deep": c(PRIMARY_DEEP),
    "--cta-tint": c(PRIMARY_TINT),
    // Cyan — graphics only. Named --cyan, not --secondary: shadcn owns
    // --secondary and an inline <html> value would override its token.
    "--cyan": c(SECONDARY),
    "--cyan-tint": c(SECONDARY_TINT),
    // Dark band
    "--abyss": c(ABYSS),
    // Warnings
    "--warn": c(WARN),
    "--warn-line": c(WARN_LINE),
    "--warn-tint": c(WARN_TINT),
  };
}

/**
 * The palette as literal hex, for the places that cannot read a CSS
 * variable: public/logo.svg, app/icon.svg and app/opengraph-image.tsx
 * (next/og resolves no variables and Tailwind classes do not apply there).
 * The two SVGs are hand-edited; keep them in step with these values.
 */
export const LITERAL = {
  paper: PAPER,
  surface: SURFACE,
  neutral: NEUTRAL,
  abyss: ABYSS,
  ink: INK,
  inkSoft: INK_SOFT,
  line: LINE,
  brand: PRIMARY,
  primary: PRIMARY,
  secondary: SECONDARY,
  cta: PRIMARY,
} as const;

/**
 * Chart series, for the admin dashboard.
 *
 * Recharts takes plain strings and cannot read a CSS variable, which is how
 * the dashboard ended up hard-coding `#121271` and `#3ec7ed` — the latter
 * being the cyan this palette retired for measuring 1.82:1. Series are
 * ordered by falling prominence and separated by LIGHTNESS as well as hue,
 * so the sequence survives being read by someone who cannot separate the
 * hues, and printed in grey.
 */
export const CHART = [
  PRIMARY, //      #0047FF  the brand blue, for the first and most-read series
  "#00A3C4", //             a darkened cyan: SECONDARY is a field colour only
  "#5B6BA8", //             muted indigo
  "#0B7A5B", //             deep green, for anything that reads as "settled"
  "#8A5A00", //             amber, darkened enough to carry a label
] as const;

/** Chart chrome: gridlines and axes, matched to the page's hairline. */
export const CHART_LINE = LINE;
