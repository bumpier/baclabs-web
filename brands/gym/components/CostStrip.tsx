import { formatGbp, type StorefrontView } from "@/lib/commerce/view";
import { MATHS } from "@/brands/gym/copy/home";

/**
 * The maths (#maths): what one vial costs in each pack on sale, as a table a
 * screen reader reads row by row, with a bar per row drawn to scale from
 * zero (the dearest vial fills the track) and how much less a vial costs than
 * in the smallest pack. Every figure is the view's own perVialMinor; nothing
 * is rounded twice. The cheapest row's bar is hazard-taped.
 *
 * Only worth showing with two packs or more on sale.
 */
export function CostStrip({ view }: { view: StorefrontView }) {
  const packs = view.packs.filter((p) => p.available);
  if (packs.length < 2) return null;
  const base = packs[0]!;
  const top = Math.max(...packs.map((p) => p.perVialMinor));
  const low = Math.min(...packs.map((p) => p.perVialMinor));

  return (
    <section id="maths" aria-labelledby="maths-heading" className="gym-maths">
      <div className="gym-wrap gym-maths-grid">
        <div>
          <h2 id="maths-heading" className="gym-h2">
            {MATHS.heading}
          </h2>
          <p className="gym-lead">{MATHS.lead}</p>
        </div>
        <table className="gym-maths-table">
          <caption className="sr-only">{MATHS.caption}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{MATHS.pack}</th>
              <th scope="col">{MATHS.perVial}</th>
              <th scope="col">{MATHS.versus}</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => {
              const pct = base.perVialMinor > 0 ? Math.round(((base.perVialMinor - p.perVialMinor) / base.perVialMinor) * 100) : 0;
              return (
                <tr key={p.sku} data-low={p.perVialMinor === low || undefined}>
                  <th scope="row" className="gym-maths-size">
                    <span className="gym-maths-n">{p.vials}</span>
                    <span className="sr-only"> {MATHS.size(p.vials)}</span>
                  </th>
                  <td className="gym-maths-bar">
                    <span className="gym-maths-track" aria-hidden="true">
                      <span style={{ width: `${(p.perVialMinor / top) * 100}%` }} />
                    </span>
                    <span className="gym-maths-price">{formatGbp(p.perVialMinor)}</span>
                  </td>
                  <td className="gym-maths-less">{p.sku === base.sku ? MATHS.base : pct > 0 ? MATHS.less(pct) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
