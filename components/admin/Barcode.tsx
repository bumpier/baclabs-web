import { code128Widths } from "@/lib/barcode/code128";

/** Scanners need this much white either side, in modules. */
const QUIET_MODULES = 10;

/**
 * A Code 128 barcode as SVG, drawn in modules and scaled by CSS to `width`.
 * Vector, so it prints sharp at any size on any printer; crispEdges stops
 * the browser anti-aliasing bar edges into grey. Keep a module at 0.25 mm or
 * wider for handheld scanners — the caller's width divided by the module
 * count — which a short code at label widths comfortably is.
 */
export function Barcode({
  value,
  width,
  height,
  showText = true,
}: {
  value: string;
  /** CSS length, e.g. "80mm". */
  width: string;
  /** CSS length of the bars. */
  height: string;
  showText?: boolean;
}) {
  const widths = code128Widths(value);
  const modules = widths.reduce((a, b) => a + b, 0) + QUIET_MODULES * 2;

  const bars: { x: number; w: number }[] = [];
  let x = QUIET_MODULES;
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });

  return (
    <div style={{ width }} className="text-center">
      <svg
        viewBox={`0 0 ${modules} 100`}
        preserveAspectRatio="none"
        style={{ width: "100%", height, display: "block" }}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Barcode ${value}`}
      >
        <rect x="0" y="0" width={modules} height="100" fill="#fff" />
        {bars.map((b) => (
          <rect key={b.x} x={b.x} y="0" width={b.w} height="100" fill="#000" />
        ))}
      </svg>
      {showText && <p className="mt-[1mm] font-mono text-[9pt] font-bold tracking-[0.15em] text-black">{value}</p>}
    </div>
  );
}
