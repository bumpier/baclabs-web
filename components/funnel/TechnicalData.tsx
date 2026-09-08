import { PRODUCT } from "@/config/funnel";
import { FACTS } from "@/content/facts";

/**
 * The reference rows: what a laboratory buyer checks and a search engine
 * quotes. Deliberately NOT the whole label — composition, format, storage
 * and the in-use limit are already in the specification list this sits
 * under, so repeating them here would only lengthen the page. Every value
 * is a chemistry constant from content/facts.ts or a label fact from
 * config/funnel.ts; a row whose value is empty is not rendered.
 *
 * Renders the bare table. The caller supplies the border, because on the
 * product page it sits inside a disclosure that already has one.
 */
export function TechnicalData() {
  const rows: { term: string; value: string }[] = [
    { term: "Also sold as", value: FACTS.synonyms.filter((s) => s !== "BAC water").join(", ") },
    { term: "Preservative", value: `Benzyl alcohol, ${FACTS.benzylAlcoholPct} (${FACTS.benzylAlcoholMgPerMl}); ${FACTS.benzylAlcoholMgPerVial} mg per vial` },
    { term: "CAS number, water", value: `${FACTS.casWater} (EC ${FACTS.ecWater})` },
    { term: "CAS number, benzyl alcohol", value: `${FACTS.casBenzylAlcohol} (EC ${FACTS.ecBenzylAlcohol})` },
    { term: "Molecular formula", value: `${FACTS.formulaWater}; preservative ${FACTS.formulaBenzylAlcohol}` },
    { term: "Appearance", value: FACTS.appearance },
    { term: "pH", value: PRODUCT.ph },
    { term: "Shelf life, unopened", value: PRODUCT.shelfLifeUnopened || "Expiry date printed on each vial" },
    { term: "Hazard classification", value: FACTS.hazardClassification },
    { term: "Origin", value: PRODUCT.origin },
  ].filter((r) => r.value);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
        <caption className="sr-only">Technical data for {PRODUCT.name}, {PRODUCT.size}</caption>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.term} className="align-top">
              <th scope="row" className={`w-56 bg-neutral px-5 py-3 font-medium text-ink sm:px-6 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>
                {r.term}
              </th>
              <td className={`px-5 py-3 text-ink-soft sm:px-6 ${i < rows.length - 1 ? "border-b border-line" : ""}`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
