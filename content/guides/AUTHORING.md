# Writing a guide

Each guide is one TypeScript file in this folder exporting a `Guide` (see `types.ts`).
It is rendered by `components/guides/GuideArticle.tsx`, which adds the schema, the
quick-answer box, the FAQ accordion, the buy card and the related links. Authors write data only.

## Hard rules

1. **No therapeutic, medical or veterinary use may be stated or implied.** The product is a
   laboratory and research diluent. Never write "inject", "dose", "patients", "your body",
   "medication", "HRT", "TRT", "peptide therapy" or any instruction to administer anything.
   When a comparison needs the phrase "bacteriostatic water for injection" (the US
   pharmacopoeial product name) it appears in the third person as a product name only.
2. **Facts come from `content/facts.ts`.** Import `FACTS` and interpolate
   `FACTS.openedLimit`, `FACTS.casWater`, `FACTS.vialMl` rather than typing the numbers.
   **Never name or quantify the preservative.** Write "a bacteriostatic preservative" and
   nothing more specific: the chemical name and its concentration trip advertising-platform
   filters and must not appear anywhere on the site.
3. **No price superlatives.** Never write "cheapest", "lowest price", "best price". The
   price-match guarantee is only stated on the home page next to its terms.
4. **No named competitors criticised.** You may say what a category of seller does
   (pharmacies, marketplaces, peptide shops) but never name a company negatively.
5. **UK English**, plain sentences, no em dashes, no exclamation marks, no emoji.
6. **Structure**: `quickAnswer` 40–60 words that answers the title directly (40–60 is the house
   preference; `checkGuideStructure` in `lib/content-rules.ts` enforces the wider 40–75, so
   nothing already published becomes unpublishable - aim for 60 and under); 5–7 `sections`
   whose headings are the sub-questions a reader would search; a `table` in any section that
   compares things; 4–6 `faq` entries answered in one to three sentences; exactly two `related`
   slugs from the list below; `updated: "2026-09-08"`.
7. `metaTitle` ≤ 60 characters, contains "bacteriostatic water"; `description` ≤ 155 characters.
8. Paragraphs are plain strings with two markup allowances: `**bold**` and
   `[label](/path)`. **Bold the phrase a reader is scanning for**, not label words -
   one or two runs per section, never a whole sentence. **Link to the product page
   from inside the copy** at the first natural mention, and to a sibling guide where
   one genuinely answers the tangent: the renderer still adds the buy card and the
   related guides, but a link a reader meets mid-sentence is the one they follow.
   Two or three in-content links per guide is plenty; more reads as spam and dilutes
   each one. Links are internal-only - a root-relative path such as `/#buy` or
   `/guides/how-to-store-bacteriostatic-water`. Anything else renders as literal
   text rather than a link, by design. Vary the anchor wording between guides;
   repeating one exact phrase across all thirteen is a pattern search engines
   discount.

## Checking a guide

Run `npm run check:guides` before committing. It validates every guide in
`index.ts` against the hard rules above: banned framing, the preservative
name, price superlatives, em dashes, the length limits, section and FAQ
counts, and that both `related` slugs exist. It exits non-zero on a
violation, so a guide that breaks a rule cannot ship by accident.

Two phrases are allowed past the framing check because they are the product's
own vocabulary: **multi-dose** (used in `config/funnel.ts`) and **for
injection** (only as part of the US pharmacopoeial product name, third person).

## Slugs

- what-is-bacteriostatic-water
- bacteriostatic-water-vs-sterile-water
- how-long-does-bacteriostatic-water-last
- how-to-store-bacteriostatic-water
- where-to-buy-bacteriostatic-water-uk
- bacteriostatic-water-vial-sizes
- how-many-draws-from-a-vial
- is-bacteriostatic-water-a-medicine-uk
- bacteriostatic-water-vs-saline
- what-multi-dose-means
- how-to-read-a-vial-label
- vial-handling-and-contamination
- diluent-volume-and-concentration

## Reference facts (safe to state)

- Bacteriostatic water is sterile water with a bacteriostatic preservative (never named or
  quantified on the site).
  The preservative inhibits bacterial growth in the vial after the stopper is punctured; it does
  not sterilise, and does not make a contaminated vial safe.
- Sterile water contains no preservative and is single-use once opened. 0.9% sodium chloride
  (saline) is an isotonic salt solution, also without preservative unless labelled bacteriostatic.
- Multi-dose vials are conventionally discarded 28 days after first puncture (the in-use limit
  on the label). Unopened, the expiry printed on the vial applies; a typical unopened shelf life
  is around two years but the label governs.
- Store unopened at room temperature away from light unless the label says otherwise; once
  opened, many laboratories refrigerate at 2–8 °C. Discard if cloudy, discoloured, containing
  particles, or past the in-use limit.
- The preservative is present below the concentration limits at which the mixture would
  inherit any classification, so the diluent is not classified as hazardous under GB CLP.
- Sizes sold in the UK: 3 ml, 10 ml, 20 ml and 30 ml vials. 30 ml vials from US manufacturers
  (the Hospira and Pfizer "Bacteriostatic Water for Injection, USP" product) are imported by some
  UK resellers at a higher price. 10 ml is the common UK laboratory size.
- In the UK there is no licensed bacteriostatic-water medicine sold over the counter; UK
  pharmacies do not generally stock it. It is sold online as a laboratory diluent by lab-supply
  and research-chemical sellers, and appears on Amazon and eBay from third-party sellers.
- BacLab sells one product: a sealed 10 ml multi-dose vial, in packs from 1 to 100.
