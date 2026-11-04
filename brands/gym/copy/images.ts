/**
 * Every photograph the site shows, in one place: its file in public/gym/
 * (served at the site root through the host rewrite), its pixel size, so
 * next/image reserves the space and nothing shifts, and its alt text.
 *
 * They are AI-generated stand-ins, made to the packaging concept (a matte
 * black box, a yellow and black hazard band across one corner, the name in
 * white stencil capitals) and to the product as it is: the clear 10ml vial
 * with the royal blue flip-off cap over a silver crimp, its label blank.
 * The brand is only ever on the box, never on the vial.
 *
 * Not through Next's image optimiser: /_next/image fetches its source
 * without the visitor's Host, so on a brand host it would ask the wrong site
 * for the file. Each photograph is instead made ahead, with sharp, as a WebP
 * original (at most 1536px wide) and smaller copies beside it,
 * name-<width>.webp, one per width in `widths`; brands/gym/components/
 * photo.ts builds the srcset from them. Remake the copies with the original.
 *
 * Imports nothing, so client components may read it.
 */

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** The smaller copies made beside the original, narrowest first. */
  widths: readonly number[];
}

/** The path of a photograph's copy at one of its `widths` (or the original). */
export function photoAt(photo: Photo, width: number): string {
  return photo.widths.includes(width) ? photo.src.replace(/\.webp$/, `-${width}.webp`) : photo.src;
}

// TODO(launch): replace with real photography: the hero on a gym floor, wide (16:9).
export const HERO_WIDE: Photo = {
  src: "/images/hero-wide.webp",
  width: 1536,
  widths: [768, 1152],
  height: 864,
  alt: "A black Brute Lab box with a yellow hazard band on a chalked 20kg plate, two blue-capped 10ml vials in front, a loaded bar behind.",
};

// TODO(launch): replace with real photography: the hero for phones, tall (9:16), the subject in the top half.
export const HERO_TALL: Photo = {
  src: "/images/hero-tall.webp",
  width: 828,
  widths: [414],
  height: 1472,
  alt: "A black Brute Lab box and a blue-capped 10ml vial on a weight bench, a chalked hand on the edge, a plate leaning on the leg.",
};

// TODO(launch): replace with real photography: the four packshots, one studio set, 4:5.
// A pack size with no photograph of its own shows none (the card keeps its stencilled count).
export const PACKSHOTS: Record<number, Photo> = {
  1: {
    src: "/images/pack-1.webp",
    width: 800,
    widths: [400],
    height: 1000,
    alt: "One 10ml vial with a blue flip-off cap beside its slim black Brute Lab carton.",
  },
  5: {
    src: "/images/pack-5.webp",
    width: 800,
    widths: [400],
    height: 1000,
    alt: "An open black Brute Lab box holding five sealed 10ml vials with blue caps in one row.",
  },
  10: {
    src: "/images/pack-10.webp",
    width: 800,
    widths: [400],
    height: 1000,
    alt: "An open black Brute Lab box holding ten sealed 10ml vials with blue caps in two rows.",
  },
  20: {
    src: "/images/pack-20.webp",
    width: 800,
    widths: [400],
    height: 1000,
    alt: "An open black Brute Lab box holding twenty sealed 10ml vials with blue caps in four rows.",
  },
};

// TODO(launch): replace with real photography: hands holding the open box over the gym floor (3:2).
export const HANDS_BOX: Photo = {
  src: "/images/hands-box.webp",
  width: 1400,
  widths: [700, 1050],
  height: 933,
  alt: "Chalked hands holding an open Brute Lab box of five blue-capped vials over a gym floor, a lifting belt beside it.",
};

// TODO(launch): replace with real photography: the Open Graph background, the wide hero cropped to 1200x630.
// Read from disk (public/gym/images/) by app/gym/og/route.tsx.
export const OG_HERO = "og-hero.jpg";
