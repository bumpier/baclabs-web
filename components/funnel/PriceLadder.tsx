import { BUNDLES, formatMinor, perVialMinor, savingPercent, shipsFree } from "@/config/funnel";

/**
 * The per-vial price ladder as plain text in a table. The purchase block
 * shows the same figures interactively; this one exists so the numbers are
 * in the HTML for a "bacteriostatic water bulk" search and for anyone who
 * wants to see the whole ladder at once. Same source, so they cannot differ.
 */
export function PriceLadder() {
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <caption className="sr-only">Price per pack and per vial</caption>
        <thead>
          <tr className="bg-neutral">
            <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">Vials</th>
            <th scope="col" className="border-b border-line px-4 py-3 text-right font-semibold text-ink">Pack price</th>
            <th scope="col" className="border-b border-line px-4 py-3 text-right font-semibold text-ink">Per vial</th>
            <th scope="col" className="border-b border-line px-4 py-3 text-right font-semibold text-ink">Saving</th>
            <th scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">UK delivery</th>
          </tr>
        </thead>
        <tbody>
          {BUNDLES.map((b) => {
            const saving = savingPercent(b);
            return (
              <tr key={b.id}>
                <th scope="row" className="border-b border-line px-4 py-3 font-medium text-ink">
                  <span className="tabular">{b.vials}</span>
                  {b.label ? <span className="ml-2 text-xs font-normal text-ink-soft">{b.label}</span> : null}
                </th>
                <td className="tabular border-b border-line px-4 py-3 text-right text-ink">{formatMinor(b.priceMinor)}</td>
                <td className="tabular border-b border-line px-4 py-3 text-right text-ink">{formatMinor(perVialMinor(b))}</td>
                <td className="tabular border-b border-line px-4 py-3 text-right text-ink-soft">{saving > 0 ? `${saving}%` : "—"}</td>
                <td className="border-b border-line px-4 py-3 text-ink-soft">{shipsFree(b.priceMinor) ? "Free" : "Charged at checkout"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
