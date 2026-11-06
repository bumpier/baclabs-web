/**
 * Every photograph on BeautyBac's pages, with its words and its size. Each
 * is an AI-generated stand-in in the brand's art direction, served from
 * public/beauty/images/ at /images/... on the brand's host (the host rewrite
 * in middleware.ts, as /icon.svg is), and drawn by next/image with its
 * intrinsic size, so nothing shifts as it loads.
 *
 * TODO(launch): replace with real photography, every image below. Keep the
 * product as it is in these stand-ins: the clear 10ml vial with its blue
 * flip-off cap and silver crimp and a blank label, in the plain, unprinted
 * white box every brand's sets go out in (a slim one for a single vial, a
 * wider, shallow one for a set, the vials upright in a card divider). The
 * name is on neither: it lives on the site and the packing slip.
 *
 * Each was checked by eye against the product truth: blue caps, silver
 * crimps, blank labels, and boxes with nothing printed on them.
 *
 * Plain data, so client components may import it.
 */
export interface BrandImage {
  /** A site path under public/beauty/. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const IMAGES = {
  // TODO(launch): replace with real photography. The hero, and the OG card's crop (public/beauty/images/og-still-life.jpg).
  stillLife: {
    src: "/images/still-life.webp",
    width: 1536,
    height: 1024,
    alt: "A sealed vial with a blue cap on a white marble plinth, blush silk falling beside it and a plain white box leaning against its base",
  },
  // TODO(launch): replace with real photography. The packshot: the gallery's first picture and the basket's thumbnail (cropped in by BOX_THUMB).
  box: {
    src: "/images/box.webp",
    width: 1024,
    height: 1024,
    alt: "A plain white box standing beside a sealed vial with a blue cap, on blush",
  },
  // TODO(launch): replace with real photography.
  setOfFive: {
    src: "/images/set-of-five.webp",
    width: 1024,
    height: 1024,
    alt: "Five sealed vials with blue caps standing in a card divider inside an open plain white box, on marble",
  },
  // TODO(launch): replace with real photography.
  vial: {
    src: "/images/vial.webp",
    width: 1024,
    height: 1024,
    alt: "One sealed 10ml vial on marble: clear glass, a blank label, a blue flip-off cap over a silver crimp",
  },
  // TODO(launch): replace with real photography.
  hands: {
    src: "/images/hands.webp",
    width: 1024,
    height: 1536,
    alt: "Two hands holding a plain white box",
  },
  // TODO(launch): replace with real photography.
  vanity: {
    src: "/images/vanity.webp",
    width: 1024,
    height: 1536,
    alt: "A marble vanity in morning light: pink ranunculus in a glass vase, folded blush towels, two plain white boxes, one of them open, and two sealed vials",
  },
  // TODO(launch): replace with real photography. /clinics and the home page's clinic panel.
  clinicCounter: {
    src: "/images/clinic-counter.webp",
    width: 1536,
    height: 1024,
    alt: "A salon reception counter in pink plaster and marble, with a stack of plain white boxes and a tray of sealed vials",
  },
  // TODO(launch): replace with real photography.
  clinicShelf: {
    src: "/images/clinic-shelf.webp",
    width: 1024,
    height: 1536,
    alt: "A pale oak shelf in a salon holding a row of plain white boxes, and a tray of sealed vials on the shelf below",
  },
} as const satisfies Record<string, BrandImage>;

/**
 * The packshot's box and vial stand in the middle of a blush field: the
 * small square thumbnails (the basket, the order) crop in on them, inside
 * a frame that clips (styles.css .bb-frame).
 */
export const BOX_THUMB = "scale-[1.85]";

/** The product gallery, in order: what arrives, a set, the vial, a set in hand. */
export const GALLERY: readonly { image: BrandImage; label: string }[] = [
  { image: IMAGES.box, label: "The box" },
  { image: IMAGES.setOfFive, label: "A set of five" },
  { image: IMAGES.vial, label: "The vial" },
  { image: IMAGES.hands, label: "In hand" },
];
