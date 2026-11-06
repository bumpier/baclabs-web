/**
 * BulkBac's photographs, every one an AI-generated stand-in (approved by
 * the owner for the redesign), in public/wholesale/images/ at three widths
 * each: <name>-640.webp, <name>-960.webp and <name>-<full>.webp.
 *
 * Every one keeps the product truth: a clear 10ml glass vial, a royal blue
 * flip-off cap over a silver aluminium crimp, a blank label, and plain
 * brown cartons with no label, print or brand on them (the owner, 6 Nov
 * 2026: "our packaging is just a box really ... just a plain box"). The
 * brand is on the website only. The blank labels the model put on the
 * cartons in the carton and stockroom photos were retouched out.
 *
 * TODO(launch): replace every image here with real photography of the
 * packed product and the real outer carton.
 *
 * Plain data, imported by server and client components alike.
 */

export interface Photo {
  /** The full-size file's site path. Its narrower copies sit beside it. */
  src: string;
  /** The widths on disk, smallest first; the last is `width`. */
  widths: readonly number[];
  width: number;
  height: number;
  alt: string;
  /** The gallery thumbnail's short name, for its button. */
  short: string;
}

/** `src` is the full-size file, written out so npm run check:brands can find it on disk. */
const photo = (src: string, width: number, height: number, alt: string, short: string): Photo => ({
  src,
  widths: [640, 960, width],
  width,
  height,
  alt,
  short,
});

/** The product gallery, in order. TODO(launch): replace with real photography. */
export const GALLERY: readonly Photo[] = [
  photo(
    "/images/case-shrinkwrap-1280.webp",
    1280,
    960,
    "A shrink-wrapped tray of 10ml glass vials, each with a blue flip-off cap, a silver crimp and a blank label.",
    "Shrink-wrapped tray"
  ),
  photo(
    "/images/cartons-1280.webp",
    1280,
    960,
    "Three plain brown cartons, unprinted and unlabelled, stacked on a concrete floor against a pale wall.",
    "Cartons"
  ),
  photo(
    "/images/vial-packshot-1280.webp",
    1280,
    960,
    "One 10ml clear glass vial on white: blue flip-off cap, silver aluminium crimp, a blank white label.",
    "Single vial"
  ),
  photo(
    "/images/stockroom-1280.webp",
    1280,
    960,
    "A tidy stockroom: grey steel shelving with rows of plain, unlabelled brown cartons and white trays of blue-capped vials.",
    "Stockroom"
  ),
];

/** Inside a carton, from above: the Packs & cartons tab. TODO(launch): replace with real photography. */
export const CARTON_OPEN: Photo = photo(
  "/images/carton-open-1280.webp",
  1280,
  960,
  "An open brown carton seen from above, its vials standing in a white card divider, five rows of five blue caps.",
  "Open carton"
);

/** A wrapped pallet of cartons in a loading bay: the quote band. TODO(launch): replace with real photography. */
export const PALLET: Photo = photo(
  "/images/pallet-1536.webp",
  1536,
  864,
  "A pallet of brown cartons wrapped in clear stretch film, standing in a bright loading bay.",
  "Pallet"
);
