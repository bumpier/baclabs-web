/**
 * Every photograph on LuxeVial's pages, with its size and its words.
 *
 * TODO(launch): replace with real photography. Every image below is an
 * AI-generated stand-in (Figma, gpt-image-2.5-flare, 4 Nov 2026) of the
 * shared vial (clear glass, royal blue flip-off cap, silver crimp, blank
 * label) with round two's packaging concept: a claret box with a seal
 * pressed into its lid, a fitted tray and a card closed with wax.
 *
 * TODO(launch): that packaging is NOT real. Every order ships in a plain,
 * unprinted, matte white box with a card divider (the owner, 6 Nov 2026),
 * so every photograph here that shows the claret box, the seal or the card
 * is to be replaced with the plain box or the vial alone, in the same
 * limestone and raking light. The page's words already describe the plain
 * box; the alt text below still describes the photographs as they are.
 * Keep the file names, sizes and alt text in step when they change.
 *
 * Each file sits in public/luxury/images/ at its full width under the name
 * below, with smaller WebP copies beside it at each of `widths`
 * (name-480.webp and so on), which the pages' srcset picks from
 * (components/photo.ts). Plain data that imports nothing, so a client
 * component may take one as a prop.
 */
export interface Photo {
  /** The full-width file, as the site serves it. */
  src: string;
  width: number;
  height: number;
  /** The smaller copies beside it, narrowest first. */
  widths: readonly number[];
  alt: string;
}

/** TODO(launch): replace with real photography. The hero, wide: box, lid ajar, and a vial on dark stone. */
export const HERO_WIDE: Photo = {
  src: "/images/hero.webp",
  width: 1536,
  height: 864,
  widths: [768, 1080],
  alt: "The claret box with its lid ajar on a dark stone plinth, beside a 10ml vial with a blue cap.",
};

/** TODO(launch): replace with real photography. The same scene, upright, for phones. */
export const HERO_TALL: Photo = {
  src: "/images/hero-portrait.webp",
  width: 864,
  height: 1536,
  widths: [480],
  alt: HERO_WIDE.alt,
};

/**
 * The product's gallery, in the order the brief asks for: the box closed,
 * open with the vial, the seal and card, the vial itself.
 * TODO(launch): replace with real photography, all four.
 */
export const GALLERY: readonly Photo[] = [
  {
    src: "/images/box-closed.webp",
    width: 960,
    height: 1280,
    widths: [480, 720],
    alt: "The claret box, closed, on pale stone, with the seal pressed into its lid.",
  },
  {
    src: "/images/box-open.webp",
    width: 960,
    height: 1280,
    widths: [480, 720],
    alt: "The box open: a 10ml vial with a blue cap in its fitted tray, beside a card closed with wax.",
  },
  {
    src: "/images/seal.webp",
    width: 960,
    height: 1280,
    widths: [480, 720],
    alt: "A cream card closed with a claret wax seal, against the corner of the box.",
  },
  {
    src: "/images/vial.webp",
    width: 960,
    height: 1280,
    widths: [480, 720],
    alt: "A 10ml glass vial with a blue flip-off cap, a silver crimp and a blank label, standing on stone.",
  },
];

/** TODO(launch): replace with real photography. Chapter one: the closed box on a stone ledge in late sun. */
export const CHAPTER_BOX: Photo = {
  src: "/images/chapter-box.webp",
  width: 1536,
  height: 1024,
  widths: [768, 1080],
  alt: "The closed claret box on a stone ledge in late sunlight.",
};

/** TODO(launch): replace with real photography. Chapter two: hands packing a vial into the box. */
export const CHAPTER_HANDS: Photo = {
  src: "/images/chapter-hands.webp",
  width: 1536,
  height: 1024,
  widths: [768, 1080],
  alt: "Hands setting a vial into the box's tray, with the lid, a sealed card and tissue paper beside it.",
};

/** TODO(launch): replace with real photography. Chapter three: the box arrived, beside its opened outer carton. */
export const CHAPTER_ARRIVAL: Photo = {
  src: "/images/chapter-arrival.webp",
  width: 1536,
  height: 1024,
  widths: [768, 1080],
  alt: "The claret box on a hallway console beside its opened outer carton.",
};

/** TODO(launch): replace with real photography. The Open Graph card's photograph (app/luxury/og), 1200 by 630. */
export const OG_PHOTO = "/images/og.jpg";
