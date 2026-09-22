import { qrMatrix } from "@/lib/barcode/qr";

/** Scanners need four modules of white around a QR code. */
const QUIET_MODULES = 4;

/**
 * A QR code as SVG, scaled by CSS to `size`. Each row's dark modules are
 * drawn as runs rather than one square apiece, which keeps a dense code to a
 * few hundred elements; crispEdges keeps the edges black-and-white when
 * printed.
 */
export function QrCode({ value, size }: { value: string; size: string }) {
  const qr = qrMatrix(value);
  const total = qr.size + QUIET_MODULES * 2;

  const runs: { x: number; y: number; w: number }[] = [];
  for (let y = 0; y < qr.size; y++) {
    let start = -1;
    for (let x = 0; x <= qr.size; x++) {
      const dark = x < qr.size && qr.isDark(x, y);
      if (dark && start < 0) start = x;
      if (!dark && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      style={{ width: size, height: size, display: "block" }}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code ${value}`}
    >
      <rect x="0" y="0" width={total} height={total} fill="#fff" />
      {runs.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x + QUIET_MODULES} y={r.y + QUIET_MODULES} width={r.w} height="1" fill="#000" />
      ))}
    </svg>
  );
}
