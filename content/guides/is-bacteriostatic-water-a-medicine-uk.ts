import type { Guide } from "@/content/guides/types";
import { FACTS } from "@/content/facts";

export const isBacteriostaticWaterAMedicineUk: Guide = {
  slug: "is-bacteriostatic-water-a-medicine-uk",
  title: "Is bacteriostatic water a medicine in the UK?",
  metaTitle: "Is bacteriostatic water a medicine in the UK?",
  description:
    "No UK-licensed bacteriostatic water exists. How the Human Medicines Regulations, GB CLP, COSHH and consumer law apply to it as a laboratory reagent.",
  quickAnswer: `No. No bacteriostatic water product holds a UK marketing authorisation, so it is not a licensed medicine and UK pharmacies do not generally stock it. In the UK it is sold as a laboratory reagent and diluent, sterile water with a bacteriostatic preservative, not assessed by the MHRA and regulated as a chemical mixture and a consumer product instead.`,
  updated: "2026-09-08",
  sections: [
    {
      heading: "Is bacteriostatic water a licensed medicine in the UK?",
      paragraphs: [
        "No. A medicine can only be sold in the UK if a specific product holds a marketing authorisation, the licence the MHRA grants after assessing quality, safety and efficacy. No bacteriostatic water product holds one. There is no UK-licensed bacteriostatic water, over the counter or otherwise, and nothing for a pharmacy to order from its wholesaler, which is why UK pharmacies do not generally stock it.",
        "The familiar medicine categories do not apply either. Prescription-only, pharmacy and general-sale are classifications attached to a licensed product when the licence is granted. With no licence there is no classification, so bacteriostatic water in the UK is not a prescription item, a pharmacy item or an over-the-counter item. It sits outside that system altogether.",
        `What is sold in the UK is a different thing in law, even though the liquid has the same composition: sterile water with a bacteriostatic preservative. Laboratory-supply and research-chemical sellers supply it as a **laboratory reagent and diluent**. It has not been assessed by the MHRA, holds no marketing authorisation, and is not presented or sold for any medical purpose. This guide describes that position and is not legal advice.`,
      ],
    },
    {
      heading: "What makes something a medicinal product under the Human Medicines Regulations 2012?",
      paragraphs: [
        "The Human Medicines Regulations 2012 define a medicinal product in two limbs, usually called presentation and function. The presentation limb asks how a product is offered: any substance presented as having properties for treating or preventing disease falls within it. The function limb asks what the substance does: whether it exerts a pharmacological, immunological or metabolic action, or is used for medical diagnosis. A product that meets either limb needs a marketing authorisation before it can be placed on the market.",
        "Bacteriostatic water sold as a reagent meets neither. It has no pharmacological, immunological or metabolic action of its own; it is a diluent, and the preservative is there to protect the contents of the vial after the stopper is first punctured. A reagent sold as a diluent is not presented as treating or preventing anything. The presentation limb is the one that matters most to sellers, because presentation is created by words, and a product's legal status can change without the contents of the vial changing at all.",
        "That is why a compliant seller makes no therapeutic claim about the product and never describes it in connection with a medical purpose. If a listing, label, email or advertisement presented bacteriostatic water as having medicinal properties, the presentation limb would be met and the seller would be placing an unlicensed medicinal product on the market, an offence enforced by the MHRA. Where a product's status is genuinely unclear, the MHRA's borderline classification team decides.",
      ],
    },
    {
      heading: "Why is it called bacteriostatic water for injection in the United States?",
      paragraphs: [
        "The name most people search for comes from the United States. There the product is a pharmacopoeial item: the United States Pharmacopeia contains a monograph titled Bacteriostatic Water for Injection, USP, and products made to it are approved by the Food and Drug Administration as drug products. Pharmaceutical manufacturers supply it, commonly in 30 ml vials, and the words for injection are part of that product's official name.",
        `The UK has no equivalent. No British Pharmacopoeia product of that name holds a marketing authorisation, and the product sold here is a laboratory reagent. When a UK listing quotes USP it is referring to the composition standard, sterile water with a bacteriostatic preservative, not claiming that the vial is the American drug product or that it is licensed anywhere. A careful UK seller therefore calls it bacteriostatic water and leaves the American name to the American product.`,
      ],
      table: {
        caption: "Bacteriostatic water in the United Kingdom and the United States compared",
        columns: ["Point of comparison", "United Kingdom", "United States"],
        rows: [
          ["Name used", "Bacteriostatic water (laboratory reagent)", "Bacteriostatic Water for Injection, USP"],
          ["Legal category", "Chemical mixture and consumer product", "Pharmacopoeial drug product"],
          ["Regulator that has assessed it", "None; not assessed by the MHRA", "Food and Drug Administration"],
          ["Licence or approval", "No marketing authorisation held", "Approved drug applications held by manufacturers"],
          ["Typical seller", "Laboratory-supply and research-chemical sellers online", "Pharmaceutical wholesalers and pharmacies"],
          ["Common vial size", `${FACTS.vialMl} ml`, "30 ml"],
          ["Composition", "Sterile water with a bacteriostatic preservative", "Sterile water with a bacteriostatic preservative"],
        ],
      },
    },
    {
      heading: "Is bacteriostatic water a medical device in the UK?",
      paragraphs: [
        "No. A medical device under the Medical Devices Regulations 2002 is an instrument, apparatus, material or article that its manufacturer intends for a medical purpose and that works principally by physical rather than pharmacological means. A device placed on the market in Great Britain carries a UKCA mark, or a CE mark while transitional recognition lasts.",
        "Bacteriostatic water sold as a reagent has no intended medical purpose assigned by its manufacturer, so it never enters the device framework. It carries no UKCA or CE mark, is not registered with the MHRA as a device, and is not a food, a food supplement or a cosmetic either. It is a chemical mixture, and that is the framework that governs it.",
      ],
    },
    {
      heading: "How is bacteriostatic water regulated in the UK instead?",
      paragraphs: [
        "Falling outside medicines and devices law does not mean falling outside the law. A laboratory reagent sold to the public in Great Britain is covered by four overlapping sets of rules.",
      ],
      list: [
        `**Chemical classification and labelling.** The GB CLP Regulation requires every mixture placed on the market to be assessed against its hazard criteria. The preservative is present below the concentration limits at which a mixture inherits the classification of its components, so the diluent is not classified. The outcome is recorded as: ${FACTS.hazardClassification}. No pictogram, signal word or hazard statement is required on the label.`,
        `**The safety data sheet.** UK REACH requires a safety data sheet for hazardous mixtures. Because this one is not classified, the law does not oblige a supplier to issue one, but a compliant seller publishes one anyway in the standard sixteen-section format. It lists the composition, the classification, first-aid and spillage measures, storage and disposal.`,
        "**Workplace handling.** Where the product is handled at work, the Control of Substances Hazardous to Health Regulations 2002 require the employer to assess the risk from every substance in use, classified or not, and decide what controls are needed. For an unclassified aqueous diluent the assessment is short, but it is still the employer's to make.",
        "**Consumer and trading law.** A seller supplying the public must describe the product accurately and must not mislead about what it is or does. The Consumer Rights Act 2015 requires goods to match their description and be of satisfactory quality; the rules on unfair commercial practices prohibit misleading actions and omissions; and the Consumer Contracts Regulations 2013 govern distance selling, including the right to cancel. The UK advertising codes separately prohibit medicinal claims for any product that is not a licensed medicine.",
      ],
    },
    {
      heading: "What should a buyer expect from a compliant UK seller of bacteriostatic water?",
      paragraphs: [
        "Because no regulator has assessed the product, the burden of describing it correctly sits entirely with the seller, and the quality of that description shows whether a seller understands what they are supplying. A compliant listing and vial should between them show the following.",
      ],
      list: [
        "**A clear statement of what the product is**: sterile water with a bacteriostatic preservative, supplied as a laboratory reagent and diluent.",
        "**A clear statement of what it is not**: not a medicinal product, not assessed by the MHRA, and not a medical device.",
        "**No therapeutic claim of any kind** in listings, packaging, emails or advertising.",
        "**The composition and the fill volume printed on the vial itself**, not only on the website.",
        `**A batch or lot number and an expiry date printed on the vial**, which anchor traceability, the ${FACTS.openedLimit} in-use limit and the unopened shelf life to a real product.`,
        "**A safety data sheet** available before purchase, and batch information on request.",
        "**A UK business address, a contact route and a returns policy** that explains the sealed-goods rule plainly.",
      ],
    },
  ],
  faq: [
    {
      q: "Is bacteriostatic water legal in the UK?",
      a: `Yes. It is not a controlled or restricted substance, and it is not classified as hazardous under the GB CLP Regulation. It is sold lawfully as a laboratory reagent.`,
    },
    {
      q: "Do you need a prescription for bacteriostatic water in the UK?",
      a: "There is no prescription status for it. Prescription-only is a classification attached to a licensed medicine, and no bacteriostatic water product holds a UK licence. It is sold as a laboratory reagent.",
    },
    {
      q: "Can you buy bacteriostatic water over the counter in the UK?",
      a: "Not from a pharmacy. There is no licensed over-the-counter product for a pharmacy to stock. It is sold by laboratory-supply and research-chemical sellers online as a laboratory reagent.",
    },
    {
      q: "Has bacteriostatic water been approved by the MHRA?",
      a: "No. The MHRA assesses medicines and oversees medical devices, and bacteriostatic water sold in the UK is neither. It holds no marketing authorisation and carries no UKCA mark. A listing that claims otherwise is wrong.",
    },
    {
      q: "Why is it called bacteriostatic water for injection in the United States?",
      a: "Because that is the title of a United States Pharmacopeia monograph and the name of the FDA-approved drug products made to it. The UK product has the same composition but is a laboratory reagent, so UK sellers do not use the American name.",
    },
    {
      q: "Does a UK seller of bacteriostatic water have to provide a safety data sheet?",
      a: `Strictly, no, because the mixture is not classified as hazardous. A compliant seller provides one anyway, since it is the document a buyer's COSHH assessment relies on.`,
    },
  ],
  related: ["where-to-buy-bacteriostatic-water-uk", "what-is-bacteriostatic-water"],
};
