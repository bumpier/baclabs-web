import QRCode from "qrcode";

/**
 * QR code as a grid of modules, for components/admin/QrCode.tsx to draw.
 * The encoding itself (Reed–Solomon, masking, version choice) is the qrcode
 * package's; this only hands back which squares are dark.
 *
 * Error correction M (about 15% of the code can be damaged or smudged and it
 * still reads) — the usual choice for printed labels that get handled.
 */
export interface QrMatrix {
  /** Modules per side, not counting the quiet zone. */
  size: number;
  isDark: (x: number, y: number) => boolean;
}

export function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return {
    size: modules.size,
    isDark: (x, y) => modules.get(y, x) === 1,
  };
}
