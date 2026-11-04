/**
 * The strip above the header on every page: true facts only, each built from
 * the storefront view by the layout (the next-day cutoff, the free-delivery
 * threshold, the pack sizes). It scrolls sideways, slowly, and stops while a
 * pointer rests on it; with reduced motion it stands still and shows what
 * fits. The facts are read once, as a list. Each run holds them twice, so one
 * run is wider than any screen, and the track holds two runs, so the loop has
 * no seam; every copy after the first is hidden from assistive technology.
 */
export function Marquee({ facts, label }: { facts: readonly string[]; label: string }) {
  if (facts.length === 0) return null;
  const items = (hidden: boolean, pass: number) =>
    facts.map((f) => (
      <li key={`${pass}-${f}`} className="gym-marquee-item" aria-hidden={hidden || undefined}>
        <span className="gym-marquee-slash" aria-hidden="true" />
        {f}
      </li>
    ));
  return (
    <section aria-label={label} className="gym-marquee">
      <div className="gym-marquee-track">
        <ul className="gym-marquee-run">
          {items(false, 0)}
          {items(true, 1)}
        </ul>
        <ul className="gym-marquee-run" aria-hidden="true">
          {items(true, 2)}
          {items(true, 3)}
        </ul>
      </div>
    </section>
  );
}
