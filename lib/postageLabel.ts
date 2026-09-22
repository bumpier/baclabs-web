/**
 * Physical size of the label stock. Kept out of the "use client" PostageLabel
 * module so server pages can read the plain values — a server import from a
 * client module gets a client reference, not the string.
 */
export const LABEL_WIDTH = "1.5in";
export const LABEL_HEIGHT = "1in";

/**
 * The sticker is the only thing on the sheet, so label routes carry their own
 * @page rule rather than the A4 default the rest of the site prints at. Pages
 * inline this in a <style> tag so it applies only while they are mounted.
 *
 * The admin shell stretches to the viewport height; on a 1in page that would
 * spill a second, blank sticker out of the printer, hence the min-height reset.
 */
export const LABEL_PRINT_CSS = `
@media print {
  @page { size: ${LABEL_WIDTH} ${LABEL_HEIGHT}; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  body :where(div, main) { min-height: 0 !important; }
  /* The page wrapper's own padding would push the sticker off the stock. */
  .label-page { margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .postage-label {
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    break-inside: avoid;
  }
}
`;
