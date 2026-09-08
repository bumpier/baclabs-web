import { PRODUCT, VIAL_ML } from "@/config/funnel";
import { FACTS } from "@/content/facts";

/**
 * The reference table: the rows a laboratory buyer checks and the rows a
 * search engine quotes. Every value is either a chemistry constant from
 * content/facts.ts or a label fact from config/funnel.ts; a row whose config
 * value is empty is not rendered, so the table never shows a placeholder.
 */
export function TechnicalData() {
  const rows: { term: string; value: string }[] = [
    { term: "Product name", value: PRODUCT.name },
    { term: "Also sold as", value: FACTS.synonyms.filter((s) => s !== "BAC water").join(", ") },
    { term: "Fill volume", value: `${VIAL_ML} ml, sealed multi-dose vial` },
    { term: "Composition", value: PRODUCT.composition },
    { term: "Preservative", value: `Benzyl alcohol, ${FACTS.benzylAlcoholPct} (${FACTS.benzylAlcoholMgPerMl}); ${FACTS.benzylAlcoholMgPerVial} mg per vial` },
    { term: "CAS number, water", value: `${FACTS.casWater} (EC ${FACTS.ecWater})` },
    { term: "CAS number, benzyl alcohol", value: `${FACTS.casBenzylAlcohol} (EC ${FACTS.ecBenzylAlcohol})` },
    { term: "Molecular formula", value: `${FACTS.formulaWater}; preservative ${FACTS.formulaBenzylAlcohol}` },
    { term: "Appearance", value: FACTS.appearance },
    { term: "pH", value: PRODUCT.ph },
    { term: "Storage, unopened", value: PRODUCT.storage },
    { term: "Shelf life, unopened", value: PRODUCT.shelfLifeUnopened || "Expiry date printed on each vial" },
    { term: "In-use limit, opened", value: PRODUCT.shelfLifeAfterOpening },
    { term: "Hazard classification", value: FACTS.hazardClassification },
    { term: "Supplied as", value: "Laboratory and research diluent. Not for human or veterinary use." },
    { term: "Origin", value: PRODUCT.origin },
  ].filter((r) => r.value);

  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
        <caption className="sr-only">Technical data for {PRODUCT.name}, {PRODUCT.size}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.term} className="align-top">
              <th scope="row" className="w-56 border-b border-line bg-neutral px-4 py-3 font-medium text-ink">
                {r.term}
              </th>
              <td className="border-b border-line px-4 py-3 text-ink-soft">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
