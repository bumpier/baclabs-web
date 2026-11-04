/**
 * The bars on a Vialhouse label: a row of bars whose widths are taken from
 * a string (an order number, a page's name), so each label looks its own.
 * Decoration only. It follows no barcode standard, encodes nothing a
 * scanner could read, and carries no number under it.
 */
export function Bars({ seed, className }: { seed: string; className?: string }) {
  let h = 2166136261;
  const widths: number[] = [];
  for (let i = 0; i < 44; i++) {
    h ^= seed.charCodeAt(i % Math.max(1, seed.length)) + i;
    h = Math.imul(h, 16777619) >>> 0;
    widths.push(1 + (h % 3));
  }
  const total = widths.reduce((a, b) => a + b, 0);
  let x = 0;
  const rects: { x: number; w: number }[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects.push({ x, w });
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${total} 40`} preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      {rects.map((r) => (
        <rect key={r.x} x={r.x} y={0} width={r.w} height={40} fill="currentColor" />
      ))}
    </svg>
  );
}
