# Review: "Page generation" content plan

Reviewed 9 September 2026 against the live site, `config/faq-full.ts`,
`/disclaimer`, and the SEO report of 8 September.

**Verdict: not implementable on baclab.co.uk as written.** Of the 8 clusters
and 40 pages proposed, 2 articles are already published, 1 was deliberately
deleted last week, and the remaining 37 would place the business in a
position its own published terms rule out. The compliant substitute is set
out at the end.

This is not a judgement on the plan's quality. As a content plan for a
peptide vendor it is coherent and well structured. It appears to have been
written for a different business.

---

## Why it does not fit this site

BacLab sells one product and says so in four places. `/disclaimer` states the
product "is not, and is not offered as, a medicinal product". `config/faq-full
.ts` answers "Do you sell peptides or anything else?" with "No… We do not
stock peptides, research compounds, syringes or other laboratory
consumables." The site is positioned as a laboratory and research diluent,
and every guide holds that line deliberately.

Clusters 2 to 8 are 35 articles about compounds BacLab does not sell, most of
them carrying human dosing protocols. Three specific problems:

**1. Advertising prescription-only medicines to the public.** Semaglutide,
tirzepatide, liraglutide, somatropin, hCG, Gonal-F and triptorelin are
prescription-only in the UK. Regulation 296 of the Human Medicines
Regulations 2012 prohibits advertising a prescription-only medicine to the
general public. Target keywords in the plan include "semaglutide for weight
loss", "retatrutide buy online" and "pt 141 dosage for men". Educational
writing about a medicine is not automatically promotion — but a commercial
site publishing dosing protocols and purchase-intent keywords for those
medicines, while selling the diluent used to mix them, is a much harder
position to defend.

**2. It would likely make the water a medicinal product by presentation.**
This is the specific risk the site's existing rules were written to avoid. A
product presented as having a role in treating or preventing disease can be a
medicinal product by presentation regardless of what it contains. Water sold
alongside "how to mix hgh with bacteriostatic water" and "reconstitution
protocols for lyophilized GLP-1 vials" is being presented as part of a
treatment, which is exactly what `/disclaimer` currently denies. That would
make it an unlicensed medicine rather than a reagent.

**3. Two named items are separately problematic.** Melanotan I and II
(Cluster 8) are unlicensed and the MHRA has repeatedly warned against their
sale for human use. Article 1.3, "Why Reconstitution Diluents Use 0.9% Benzyl
Alcohol", asks for the exact page that was deleted on 8 September and 301'd
to `/guides/what-is-bacteriostatic-water`, because naming and quantifying the
preservative trips Meta's ad review. Publishing it would re-break paid
acquisition.

The SEO report of 8 September reached the same conclusion independently, in
its own words: "Do not target injection instructions, human peptide dosing,
weight-loss treatment, veterinary administration or pharmaceutical-brand
terms for products BacLab does not sell… Do not publish dosing calculators or
instructions for human administration."

---

## What in the plan is already built

Cluster 1 is the only cluster aimed at what BacLab actually sells, and it is
substantially live already:

| Plan item | Status |
|---|---|
| 1.1 Bacteriostatic vs sterile water | Published, `/guides/bacteriostatic-water-vs-sterile-water` |
| 1.2 Storage, shelf life, the 28-day rule | Published as two guides, `/guides/how-to-store-bacteriostatic-water` and `/guides/how-long-does-bacteriostatic-water-last` |
| 1.3 Benzyl alcohol deep-dive | Deleted 8 Sept, 301 in `next.config.js`. Do not restore |
| 1.4 Reconstituting hCG, HGH, Somatropin | Prescription-only medicines. Not publishable here |
| Pillar `/reconstitution/` | The equivalent hub exists at `/guides`, plus `/calculator` |

The plan's own internal-linking diagram — a supplies hub linking to "vs
sterile water", "storage and the 28-day rule" and a mixing calculator — is a
description of what `/guides` already does.

---

## The compliant substitute

The demand this plan is chasing is real. Most of it can be reached without
naming a single compound BacLab does not sell, by writing about the diluent's
properties rather than about what someone might dissolve in it.

Ranked by expected value, none requiring a fact the operator has not supplied:

1. **Bacteriostatic water vs 0.9% sodium chloride (saline).** The second most
   common diluent comparison after sterile water, and entirely a question
   about the diluent. Completes the comparison set.
2. **Reading a vial label.** Batch, expiry, fill volume, storage line, what
   each field means and which are batch-specific. Pairs with the new
   `/quality-and-documentation` page and is the kind of original,
   photograph-led asset the SEO report asked for.
3. **Why a vial can be re-entered.** What multi-dose means, what the
   preservative does and does not do, why the in-use limit exists and what
   ends it. Currently spread across three guides with no page owning it.
4. **Vial handling and contamination control.** Stopper disinfection, drawing
   technique as a matter of keeping the vial clean, when to discard.
   Laboratory practice, not administration.
5. **Diluent volume and resulting concentration.** `/calculator` already does
   the arithmetic; a guide explaining it captures the calculator queries
   without prescribing a dose for anything.

Each is a `content/guides/*.ts` data file following `content/guides/
AUTHORING.md`, registered in `content/guides/index.ts`, which feeds the
sitemap, the guides hub and `llms.txt` automatically.

**Before writing any of them**, the higher-value work is still the four
blocked items in `docs/OPERATOR-FACTS.md`. A contact route, seller identity
and a dispatch time will move conversion and trust further than five more
guides will move traffic, and two of them gate claims already on the page.

---

## If this plan is for a different site

If a separate peptide storefront is planned, this plan belongs there and not
in this repo, and the questions above change shape — though the prohibition
on advertising prescription-only medicines to the UK public follows the
audience, not the domain, and would still rule out much of Clusters 2, 4, 5
and 8 for a UK-facing site.
