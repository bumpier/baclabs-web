import { brand } from "@/config/brand";
import { PRODUCT, VIAL_ML } from "@/config/funnel";
import { FACTS } from "@/content/facts";

/**
 * The safety data sheet, section by section, as data. The page renders it and
 * emits ChemicalSubstance structured data; nothing here is presentation.
 *
 * A mixture that is not classified as hazardous does not require an SDS
 * under UK REACH Article 31, but one must be supplied on request and it is
 * the reference document a laboratory buyer expects to find. Every statement
 * is about the mixture as sold; classification data for the pure preservative
 * is given for completeness and labelled as such.
 */
export const SDS_REVISION = "2026-09-08";
export const SDS_VERSION = "1.0";

export interface SdsSection {
  heading: string;
  /** Plain paragraphs. */
  paragraphs?: string[];
  /** Label/value rows. */
  rows?: [string, string][];
  list?: string[];
}

const supplier = brand.company.legalName || brand.name;
const contact = [brand.company.registeredAddress, brand.contact.email].filter(Boolean).join(". ");

export const SDS_SECTIONS: SdsSection[] = [
  {
    heading: "Identification of the substance/mixture and of the company",
    rows: [
      ["Product name", PRODUCT.name],
      ["Synonyms", "Bac water; bacteriostatic mixing water; mixing water"],
      ["Product form", `Liquid, ${VIAL_ML} mL sealed multi-dose glass vial`],
      ["Recommended use", "Sterile diluent and solvent for reconstituting or diluting substances for laboratory and research purposes."],
      ["Uses advised against", "Not for human or veterinary use. Not a medicinal product or a medical device. Not for administration to humans or animals by any route."],
      ["Supplier", supplier + (contact ? `. ${contact}` : "")],
      ["Emergency contact", brand.contact.email || "See the contact page"],
    ],
  },
  {
    heading: "Hazards identification",
    rows: [
      ["Classification (GB CLP)", FACTS.hazardClassification + "."],
      ["Signal word", "None"],
      ["Hazard pictograms", "None"],
      ["Hazard statements", "None"],
      ["Precautionary statements", "None required"],
      ["Other hazards", "None known. The preservative, benzyl alcohol, is classified as a pure substance (see section 3); at 0.9% w/v the mixture does not meet the criteria for classification. Broken glass presents a cut hazard."],
    ],
  },
  {
    heading: "Composition / information on ingredients",
    paragraphs: ["Mixture. Components and their classification as pure substances:"],
    rows: [
      [`Water (CAS ${FACTS.casWater}, EC ${FACTS.ecWater})`, "≥ 99% w/v. Not classified."],
      [`Benzyl alcohol (CAS ${FACTS.casBenzylAlcohol}, EC ${FACTS.ecBenzylAlcohol})`, `${FACTS.benzylAlcoholPct} (${FACTS.benzylAlcoholMgPerMl}). Pure substance: Acute Tox. 4 (H302, H332), Eye Irrit. 2 (H319). Below the generic concentration limits (1% acute toxicity, 10% eye irritation) in this mixture.`],
    ],
  },
  {
    heading: "First-aid measures",
    rows: [
      ["Eye contact", "Rinse with clean water for several minutes, removing contact lenses if present and easy to do. Seek medical advice if irritation persists."],
      ["Skin contact", "Wash with soap and water. No adverse effects expected."],
      ["Ingestion", "Rinse the mouth. Do not induce vomiting. Seek medical advice if a large quantity is swallowed or if symptoms occur."],
      ["Inhalation", "Not a relevant route of exposure for an aqueous solution at this concentration. Move to fresh air if discomfort occurs."],
      ["Most important symptoms", "None expected from the mixture. Benzyl alcohol may cause mild eye irritation on direct contact."],
      ["Medical attention", "Treat symptomatically."],
    ],
  },
  {
    heading: "Fire-fighting measures",
    rows: [
      ["Suitable extinguishing media", "The product is an aqueous solution and is not flammable. Use media appropriate to the surrounding fire."],
      ["Unsuitable media", "None known."],
      ["Special hazards", "None. Thermal decomposition of the small benzyl alcohol content may produce carbon oxides."],
      ["Advice for fire-fighters", "Standard protective equipment for the surrounding fire."],
    ],
  },
  {
    heading: "Accidental release measures",
    rows: [
      ["Personal precautions", "Wear gloves and eye protection when handling broken glass. Avoid slipping on spilled liquid."],
      ["Environmental precautions", "Small quantities may be flushed to drain with plenty of water where local rules permit. Avoid release of large quantities to watercourses."],
      ["Containment and clean-up", "Absorb with paper towel or inert absorbent, collect broken glass with tongs or a brush, and dispose of as in section 13. Wipe the area with water."],
    ],
  },
  {
    heading: "Handling and storage",
    rows: [
      ["Handling", "Use aseptic technique. Swab the stopper before each entry. Allow a refrigerated vial to reach room temperature before opening to avoid condensation. Do not leave a needle in the stopper. Record the date of first puncture on the vial."],
      ["Storage", PRODUCT.storage ? `${PRODUCT.storage}. Keep upright, sealed and protected from light.` : "As printed on the label. Keep upright, sealed and protected from light."],
      ["In-use period", `Discard ${FACTS.openedLimitDays} days after the stopper is first punctured (${FACTS.openedLimit}). An unopened vial is governed by the printed expiry date.`],
      ["Incompatibilities", "Strong oxidising agents (benzyl alcohol)."],
    ],
  },
  {
    heading: "Exposure controls / personal protection",
    rows: [
      ["Occupational exposure limits", "No UK workplace exposure limit (EH40/2005) is assigned to the mixture or to benzyl alcohol."],
      ["Engineering controls", "General laboratory ventilation is sufficient."],
      ["Eye protection", "Safety glasses, as good laboratory practice."],
      ["Hand protection", "Nitrile gloves, as good laboratory practice and for handling glass."],
      ["Respiratory protection", "Not required under normal use."],
    ],
  },
  {
    heading: "Physical and chemical properties",
    rows: [
      ["Appearance", FACTS.appearance],
      ["Odour", "Faint, slightly aromatic (benzyl alcohol)"],
      ["pH", PRODUCT.ph || "Not determined for this product. Bacteriostatic water is typically in the range 4.5 to 7.0."],
      ["Melting point / freezing point", "Approximately 0 °C"],
      ["Boiling point", "Approximately 100 °C"],
      ["Flash point", "Not applicable (aqueous solution)"],
      ["Flammability", "Not flammable"],
      ["Relative density", "Approximately 1.0 (water)"],
      ["Solubility", "Miscible with water"],
      ["Vapour pressure", "As water, approximately 2.3 kPa at 20 °C"],
    ],
  },
  {
    heading: "Stability and reactivity",
    rows: [
      ["Reactivity", "None under normal conditions."],
      ["Chemical stability", "Stable when stored as directed and sealed."],
      ["Hazardous reactions", "None known."],
      ["Conditions to avoid", "Freezing (glass and seal integrity), excessive heat, direct sunlight."],
      ["Incompatible materials", "Strong oxidising agents."],
      ["Hazardous decomposition products", "None under normal conditions."],
    ],
  },
  {
    heading: "Toxicological information",
    paragraphs: [
      "The mixture is not classified for any health hazard. Information on the pure preservative is given for completeness.",
    ],
    rows: [
      ["Acute toxicity", "Mixture: not classified. Benzyl alcohol (pure): Acute Tox. 4, oral and inhalation."],
      ["Skin corrosion / irritation", "Not classified."],
      ["Serious eye damage / irritation", "Mixture: not classified. Benzyl alcohol (pure): Eye Irrit. 2."],
      ["Sensitisation", "Not classified."],
      ["Germ cell mutagenicity", "Not classified."],
      ["Carcinogenicity", "Not classified."],
      ["Reproductive toxicity", "Not classified."],
      ["STOT single / repeated exposure", "Not classified."],
      ["Aspiration hazard", "Not classified."],
    ],
  },
  {
    heading: "Ecological information",
    rows: [
      ["Toxicity", "Not classified as hazardous to the aquatic environment."],
      ["Persistence and degradability", "Benzyl alcohol is readily biodegradable."],
      ["Bioaccumulative potential", "Low (benzyl alcohol log Kow approximately 1.1)."],
      ["Mobility in soil", "Miscible with water; mobile."],
      ["Other adverse effects", "None known."],
    ],
  },
  {
    heading: "Disposal considerations",
    list: [
      "Small residual quantities may be flushed to drain with plenty of water where local regulations permit.",
      "Empty and broken glass vials go to glass or sharps waste according to laboratory procedure, never to general waste loose.",
      "Larger quantities, or product that has been used with other substances, are disposed of according to the rules that apply to those substances, through a licensed waste contractor where required.",
    ],
  },
  {
    heading: "Transport information",
    rows: [
      ["UN number", "Not assigned"],
      ["ADR / RID / IMDG / IATA", "Not classified as dangerous goods for transport."],
      ["Packing group", "Not applicable"],
      ["Environmental hazards", "None"],
      ["Special precautions", "Protect glass from breakage."],
    ],
  },
  {
    heading: "Regulatory information",
    list: [
      "GB CLP Regulation (Regulation (EC) No 1272/2008 as retained in UK law): not classified.",
      "UK REACH: a safety data sheet is not required for a mixture that is not classified; this sheet is provided as product information under Article 32 and on request.",
      "Human Medicines Regulations 2012: this product is not a medicinal product and is not supplied as one.",
      "Supplied for laboratory and research use only. The receiving laboratory is responsible for compliance with its own COSHH assessment.",
    ],
  },
  {
    heading: "Other information",
    rows: [
      ["Revision date", SDS_REVISION],
      ["Version", SDS_VERSION],
      ["Abbreviations", "CAS: Chemical Abstracts Service. EC: European Community number. CLP: Classification, Labelling and Packaging. STOT: specific target organ toxicity. EH40: HSE workplace exposure limits publication. w/v: weight per volume."],
      ["Full text of H statements in section 3", "H302 Harmful if swallowed. H332 Harmful if inhaled. H319 Causes serious eye irritation. These apply to pure benzyl alcohol, not to this mixture."],
      ["Basis", "Prepared from the composition of the product and the published classification of its components. The information is believed accurate at the revision date and describes the product for the purpose of safe handling; it is not a specification and does not constitute a warranty."],
    ],
  },
];
