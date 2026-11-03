import { brandFor } from "@/brands/registry";

/**
 * The small coloured chip that marks a row's brand in the admin: the brand's
 * two-letter short code on its primary colour (components/admin/BrandChip.tsx).
 *
 * Plain data, worked out on the server from the registry, so a client
 * component (the scan station) can draw a chip without importing every
 * brand's profile.
 */
export interface BrandChipData {
  id: string;
  name: string;
  shortCode: string;
  background: string;
  /** White or black, whichever is more readable on `background`. */
  color: string;
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";
/** For a colour that cannot be read: a neutral grey that white is readable on. */
const FALLBACK_BACKGROUND = "#4B5563";

function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rgb or #rrggbb colour, or null if it is neither. */
export function luminance(hex: string): number | null {
  const rgb = channels(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a) ?? 0;
  const lb = luminance(b) ?? 0;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * White or black text, whichever contrasts more with `background`. One of
 * the two always reaches at least 4.58:1, above WCAG AA's 4.5:1 for small
 * text, whatever colour a brand picks.
 */
export function textOn(background: string): string {
  return contrastRatio(WHITE, background) >= contrastRatio(BLACK, background) ? WHITE : BLACK;
}

/** The chip for a stored brand id. An unregistered id reads as BacLab, as everywhere else. */
export function brandChip(id: string | null | undefined): BrandChipData {
  const b = brandFor(id);
  const background = luminance(b.colours.primary) === null ? FALLBACK_BACKGROUND : b.colours.primary;
  return { id: b.id, name: b.name, shortCode: b.shortCode, background, color: textOn(background) };
}
