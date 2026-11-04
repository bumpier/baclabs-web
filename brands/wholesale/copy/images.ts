/**
 * Vialhouse's photographs, every one an AI-generated stand-in (approved by
 * the owner for the redesign), in public/wholesale/images/ at three widths
 * each: <name>-640.webp, <name>-960.webp and <name>-<full>.webp.
 *
 * Every one keeps the product truth: a clear 10ml glass vial, a royal blue
 * flip-off cap over a silver aluminium crimp, a blank label, and the brand
 * only on the carton. The Vialhouse shipping label on the carton photo is
 * not the model's: it is drawn from the brand's own wordmark and the
 * catalogue's real code (WHL-10ML-X100) and laid onto a blank label, and
 * its bars encode nothing.
 *
 * TODO(launch): replace every image here with real photography of the
 * packed product and the real outer carton and label.
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
    "/images/cartons-labelled-1280.webp",
    1280,
    960,
    "Three plain brown cartons stacked on a concrete floor, the front one carrying a Vialhouse label with the code WHL-10ML-X100 and the line 100 × 10ml vials.",
    "Labelled cartons"
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
    "A tidy stockroom: grey steel shelving with rows of plain brown cartons and white trays of blue-capped vials.",
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
