# SXO findings — baclab.co.uk (/)

Method note: BRIEF.md records that the plugin's Python render/parse tools are unavailable in this environment (no Python 3.10+). Per brief instructions, this analysis uses `raw/home.html` (fetched 2026-09-08, pre-existing snapshot) instead of re-running `render_page.py`/`parse_html.py`. SERP data comes from WebSearch summaries (Google does not expose literal PAA/AI Overview box text to this tool — see Limitations) plus the existing competitor teardown at `competitor-profiles/uk-peptides.md` and its raw scrape `competitor-profiles/raw/uk-peptides/2026-09-08/scrapes/blog-bac-vs-sterile.txt`, which documents a live, ranking competitor article for one of the four target queries.

Target queries: "bacteriostatic water uk", "buy bacteriostatic water", "bacteriostatic water 10ml", "bacteriostatic water vs sterile water".

---

## Lead finding — page-type mismatch on the comparison query

**[CRITICAL] Single homepage funnel cannot compete for "bacteriostatic water vs sterile water"**
- Location: whole page (no dedicated URL exists for this intent)
- Issue: For the three buy-intent queries ("bacteriostatic water uk", "buy bacteriostatic water", "bacteriostatic water 10ml"), the top organic results are near-uniformly single-vendor **Product Pages** (Imperial Peptides, UK Peptide Lab, Midshire Labs, Bluewell Peptides, Tide Labs, Sterling Peptides, bacteriostatic-water-uk.com, uk-peptides.com, thesecretbeautystore.com), occasionally alongside an Amazon marketplace search-results page for the broadest query. baclab.co.uk/ *is* a Product Page by the taxonomy (price + buy button + spec list + Product schema present) — that part is genuinely aligned.

  But "bacteriostatic water vs sterile water" returns a completely different dominant type: **Blog Post / Comparison Page** — study.com (an educational "lesson" page), Mountainside Medical (two separate blog posts), Farris Labs blog, Elements Arms blog, American Peptides blog. Evidence from the sibling competitor audit confirms this pattern directly: uk-peptides.com ranks for this exact comparison intent with a dedicated `/blog/bacteriostatic-vs-sterile-water` **Article**, ~1,150 words, Article+Person schema, and a reported ~55k views (`competitor-profiles/uk-peptides.md`, line 27).

  baclab.co.uk's only content addressing this query is two FAQ `<details>` items ("How is it different from sterile water?", ~35 words) and one comparison-table row ("Preservative: 0.9% benzyl alcohol" vs "None in plain sterile water") buried inside the mid-page "How it compares" section (`raw/home.html`, `id="compare-heading"`) — no dedicated URL, no author, no publish/updated date, no Article/HowTo schema, and it sits below the fold on a page whose `<title>` and H1 are both transactional ("Buy Bacteriostatic Water UK — 10ml vial, £5.99" / "Bacteriostatic water, sealed at ten millilitres."), not comparative. A 35-word FAQ answer on a transactional homepage is structurally very unlikely to outrank a 1,150-word dedicated comparison article from a competitor already ranking for the identical string.
- Fix: Ship a standalone, dated, non-transactional page (e.g. `/bacteriostatic-water-vs-sterile-water`) that answers the comparison in the same register as the existing FAQ (composition, preservative mechanism, multi-dose vs single-use, 28-day in-use limit) with an Article/FAQPage schema pairing, a visible "last updated" date, and an internal link back to `/#buy`. Keep it strictly in the RUO/laboratory-diluent register already used on the FAQ — do not add reconstitution walkthroughs, dosing guidance, or any language implying human/animal administration; the existing disclaimer wording ("Not a medicine... not for administration to humans or animals... No therapeutic claim is made") is the right tone to extend, not deviate from.

Severity rating: **CRITICAL** for the comparison query, **ALIGNED (with gaps)** for the three transactional queries. Net mismatch across the four target queries: **HIGH** — 1 of 4 queries is unwinnable in the current architecture, and the other 3 are winnable but under-armed (see below).

---

## Other SXO findings

**[HIGH] No trust/social-proof signals anywhere on the page**
- Location: entire page — confirmed by direct search of `raw/home.html` for "review", "testimonial", "trustpilot", "rating", "★": zero matches.
- Issue: Every competitor product page surfaced in SERP research carries some form of social proof or third-party legitimacy signal — uk-peptides.com displays live stock/sold/view counters, a COA (certificate of analysis) selector, and a footer with Company No. 08033431, VAT No., and a registered Middlesbrough address (`competitor-profiles/uk-peptides.md`, lines 14, 29, 36). baclab.co.uk's footer has no company number, no VAT number, no registered address — only an email link and the RUO disclaimer. For a lab-reagent purchase where "is this a legitimate, compliant UK seller?" is a live objection (evidenced by the RUO disclaimer language every competitor repeats), the absence of any registration/legitimacy signal is a real gap, not a cosmetic one.
- Fix: Add company registration number + registered address to the footer (Companies House-style trust block, next to the existing "Payments processed securely by Stripe" line); consider a COA link or "batch testing" statement per vial if one exists, since competitors lead with this.

**[MEDIUM] Bundle/wholesale path dead-ends at a static FAQ answer**
- Location: `id="buy"` bundle selector (max 10 packs of any tier, i.e. up to 1,000 vials at the 100-pack tier) and the FAQ item "Do you sell in bulk or wholesale?"
- Issue: The FAQ answer text is "get in touch at hello@baclab.co.uk" for anything larger — there is no bulk-quote form, no account/credit-terms mention, and no link from the bundle selector itself to that path. A genuine wholesale researcher (lab, university dept, reseller) has to read a collapsed FAQ item to discover the only escalation path exists.
- Fix: Add a one-line "Ordering more than 1,000 vials? Get a wholesale quote →" link directly under the bundle selector, pointing to `/contact` with a pre-filled subject line, rather than relying on FAQ discovery.

**[MEDIUM] Definitional content is jargon-forward for a true first-time visitor**
- Location: `id="hero-heading"` and subhead (`raw/home.html`)
- Issue: The H1/subhead assumes the reader already knows what "bacteriostatic," "benzyl alcohol," and "sterile" mean in this context ("Sterile water with 0.9% benzyl alcohol as a bacteriostatic preservative"). The plain-English definition ("Sterile water containing 0.9% benzyl alcohol as a bacteriostatic preservative. The preservative inhibits the growth of bacteria...") only appears as the first collapsed FAQ item, well below the fold. Competing informational content (study.com "lesson" framing, Mountainside Medical explainer posts) leads with the plain definition first.
- Fix: Not a rewrite of the hero (which correctly targets the transactional query) — instead surface the first FAQ answer as a short, always-visible line directly under the hero subhead or as an expanded (not collapsed) first FAQ item, so a first-time visitor doesn't have to know to click "Questions" to find it.

**[LOW] Comparison table's own price claim isn't independently checkable**
- Location: `id="compare-heading"`, "Price per ml" row
- Issue: Table states "£0.60 for one vial, down to £0.27 at 100 vials" against a "Typical alternative: Varies" row, with a disclaimer that named sellers aren't compared. That disclaimer is honest and correctly avoids unverifiable claims, but it means the research-buyer persona (who WebSearch confirms is actively price-comparing — see competitor prices from £3.49 to £9.99 per vial in the SERP) gets no help placing BacLab's £0.60–£0.27/ml inside that real range.
- Fix: The existing "UK price match guarantee" section already does the comparative-trust work editorially safely (matching, not disparaging) — make sure it's linked from the comparison table row itself (it currently only links from the caption below the table), and consider adding a static "typical UK market range: circa £X–£Y per vial" range citation if a defensible, non-named-seller source is available, so the buyer doesn't have to leave the page to sanity-check the price.

---

## SERP feature signals and what would win them

- **PAA (People Also Ask):** Not directly retrievable as literal box text via this tool, but WebSearch summaries consistently surface the same question clusters that baclab.co.uk's own FAQPage schema already answers 1:1 (what is it / how does it differ from sterile water / what's the benzyl alcohol for / does it sterilise a contaminated vial / storage & shelf life / how many draws per vial). This is a genuine strength — the FAQPage schema (11 Q&As, `raw/home.html`) is well-matched to the likely PAA cluster in structure and tone. The gap is placement/visibility (collapsed, below fold), not content quality.
- **Shopping / merchant results:** Amazon.co.uk's category search page appeared for the broadest query ("bacteriostatic water uk"), and Google Shopping-style rich results (price/availability chips) are plausible for the transactional queries given every competitor shows a price in title tags. baclab.co.uk's Product JSON-LD has 8 `Offer`s with price/currency/availability, which is the right shape for Merchant Center eligibility, but has no `image`, no `review`/`aggregateRating`, and all 8 offers share one URL (`https://baclab.co.uk/#buy`) rather than distinct offer URLs — flag to `/seo schema` for a proper Merchant Center feed review; out of scope for this SXO pass beyond noting the SERP-feature link.
- **AI Overview:** The definitional and comparison queries in this set ("what is X" / "X vs Y") are the pattern most likely to trigger an AI Overview. Google's synthesis for this kind of query tends to draw on content with visible authorship, dates, and citation-style structure (study.com, clinical-supplier blogs) — exactly the E-E-A-T signals the homepage lacks (no author, no dates, no citations) and that a dedicated comparison page (see CRITICAL finding above) would add. Recommend `/seo content` for a deeper E-E-A-T pass once that page exists.
- No local-intent signals were observed in any of the four SERPs (no map pack, no "near me" related searches) — `/seo local` is not applicable here; this is a national e-commerce funnel, correctly.

---

## User stories (derived from SERP signals, not assumptions)

1. **As a research buyer comparing price per ml**, I want to quickly see where this vial sits against other UK suppliers, because prices in the SERP range from £3.49 to £9.99 per vial with wildly different bundle structures (source: WebSearch price comparison across ukpeptidelab.co.uk £6.99, tidelabs.co.uk £6.90, bac-water.com £3.49, thoroughbredlabs.co.uk £9.99), but I'm blocked by **price sensitivity without a market anchor** — BacLab states its own per-ml price prominently but explicitly declines to name where it sits in the market. *(Journey stage: Consideration)*

2. **As a first-time buyer**, I want a plain-English definition before I commit to buying, because the dominant informational-query results (study.com "lesson", supplier blog explainers) show Google treats "what is bacteriostatic water" as a real, separate need from "buy bacteriostatic water," but I'm blocked by an **information gap above the fold** — the plain definition exists only in a collapsed FAQ item below three other sections. *(Journey stage: Awareness)*

3. **As a bulk/wholesale buyer**, I want a clear path to order beyond the largest listed bundle, because every competitor site studied (per `competitor-profiles/uk-peptides.md`) structures pricing around volume tiers up to and beyond 100+ units, but I'm blocked by a **dead-end** — the only escalation path is a generic email FAQ answer with no form or account path. *(Journey stage: Decision)*

4. **As a compliance/legitimacy-conscious researcher**, I want to see who I'm actually buying from before I pay, because the RUO disclaimer language recurring across every competitor site signals this audience actively checks for it, but I'm blocked by a **trust gap** — no company number, VAT number, or registered address anywhere on the page, unlike the competitor benchmark which displays all three in its footer. *(Journey stage: Consideration)*

5. **As a comparison-stage researcher weighing bacteriostatic vs. sterile vs. saline water**, I want a neutral, citable explanation of the difference, because Google surfaces dedicated educational articles (not product pages) for this exact query string, but I'm blocked by a **page-type mismatch** — there is no URL on baclab.co.uk built to be that article. *(Journey stage: Awareness/Consideration)*

---

## Persona scores (0–25 per dimension, 100 total)

| Persona | Relevance | Clarity | Trust | Action | Total | Rating |
|---|---|---|---|---|---|---|
| Comparison-stage researcher (vs sterile/saline) | 15/25 | 10/25 | 9/25 | 8/25 | **42/100** | Critical Mismatch |
| Compliance/legitimacy-conscious researcher | 20/25 | 11/25 | 6/25 | 12/25 | **49/100** | Needs Work |
| Bulk/wholesale buyer | 22/25 | 16/25 | 10/25 | 13/25 | **61/100** | Good |
| First-time buyer (what is it?) | 22/25 | 13/25 | 12/25 | 16/25 | **63/100** | Good |
| Research buyer comparing price per ml | 23/25 | 20/25 | 14/25 | 23/25 | **80/100** | Excellent |

### Weakest persona: Comparison-stage researcher (42/100)
**Top issue:** No page on the site is structurally built to serve this query — this is the CRITICAL page-type mismatch above, not a content-quality problem.
**Recommended fix:** Ship the standalone comparison page described in the lead finding; do not attempt to fix this by expanding the homepage FAQ answer, since the homepage's title/H1/schema all correctly target the transactional query and diluting that focus would hurt the three queries the page currently serves well.

### Second-weakest: Compliance/legitimacy-conscious researcher (49/100)
**Top issue:** Trust dimension (6/25) — no company number, VAT number, or registered address anywhere on the page.
**Recommended fix:** Add a Companies House-style trust line to the footer, next to the existing Stripe/payment-security copy.

### Systemic issue across all five personas
**Trust dimension averages 10.2/25** — the lowest of the four dimensions across every persona. This single gap (no reviews, no registration details, no COA/batch info) is dragging down all five scores and is fixable without touching page type or funnel structure.

### Priority actions
1. Add company registration number + registered address to the footer (fixes Trust for the compliance persona and partially for all others — cheapest, highest-leverage fix).
2. Ship a standalone `/bacteriostatic-water-vs-sterile-water` page in the existing RUO register (fixes the CRITICAL page-type mismatch for the comparison-stage persona).
3. Surface the plain-English definition above or immediately below the hero fold instead of only in a collapsed FAQ item (fixes Clarity for the first-time-buyer persona).
4. Add a wholesale-quote link directly under the bundle selector (fixes Action for the bulk-buyer persona).

---

## Limitations

- WebSearch does not expose literal PAA box text, AI Overview text, or ad copy — SERP-feature findings above are inferred from result-set composition and result summaries, not screenshots of the live SERP. Treat PAA/AI Overview claims as directional, not verbatim.
- `render_page.py`/`parse_html.py` were unavailable in this environment (no Python 3.10+, per BRIEF.md); this analysis used the pre-fetched `raw/home.html` snapshot (2026-09-08) rather than a fresh rendered fetch. The site is Next.js App Router SSR/SSG (per BRIEF.md), so the raw HTML snapshot should already reflect the server-rendered DOM; no client-only content is expected to be missing, but this was not independently re-verified with a headless render in this session.
- Competitor SERP page-type classification relied on WebSearch's result titles/snippets plus one existing deep-dive (`competitor-profiles/uk-peptides.md`) rather than fetching and rendering all 10 organic results per query; page types for the 6 minor competitor domains not covered by the existing profile were classified from title tag and snippet pattern only.
- No screenshot/visual above-the-fold verification was performed (`baclab.co.uk-audit/screenshots/` is empty); "above the fold" judgments are based on DOM order in `raw/home.html`, which is a reasonable but imperfect proxy for actual viewport rendering across breakpoints.

---

## SXO Gap Score: 54/100

(Separate from any SEO Health Score — this measures how well the page's structure and content match what searchers and Google's SERP are actually rewarding for the four target queries, not technical SEO hygiene.)

**What works:** The transactional funnel itself is genuinely strong — hero-level per-ml pricing, a well-structured 8-tier bundle selector with live order summary, and an FAQPage schema that closely mirrors the likely PAA cluster all serve the "buy" and "10ml" queries well (research-buyer persona scores 80/100). The RUO/non-therapeutic disclaimer language is consistently and correctly applied throughout, which is exactly right for this product category and should be preserved as the tone template for any new content.

Recommend `/seo content` for an E-E-A-T-focused pass once a comparison/educational page exists, and `/seo schema` to review the Product JSON-LD's Merchant Center readiness (missing `image`/`review`/`aggregateRating`, shared offer URLs).

Generate a PDF report? Use `/seo google report`.
