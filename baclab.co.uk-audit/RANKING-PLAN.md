# baclab.co.uk — Plan to rank higher

Built from the eight specialist findings in `findings/` (technical, content, schema, sitemap, performance, GEO, SXO, e-commerce), the competitor profile in `competitor-profiles/uk-peptides.md`, and a check of the working tree on 8 September 2026. Every action cites the finding it closes so the evidence is one click away.

House rules that bound every item: no therapeutic, medical or "for injection" framing anywhere; an empty config value renders nothing rather than a placeholder; the "Cheapest in the UK" superlative only ever appears beside its `#guarantee` link on the home page.

---

## 1. Where we are

| Signal | Today | Why it matters |
|---|---|---|
| SEO health score | 66 / 100 | Content 58, e-commerce 44, SXO 54 are the drags |
| Indexable URLs live | 6 (home + 5 legal) | Competitor has ~139; every informational query goes to them |
| Indexable URLs in working tree | 24 (adds /guides ×7, /faq, /calculator, /safety-data-sheet) | Built but not deployed |
| Product rich-result eligible | No (no `image` live) | Fixed in tree, not deployed |
| AI answer engines see | £7.50 / 5 bundles via stale `/llms.txt` | Fixed in tree, not deployed |
| Trader identity | None (legal name, number, address all empty) | Trust dimension averages 10 / 25 across all personas |
| "Cheapest in the UK" | False at entry tier (£5.99 vs £5.95 at uk-peptides) | ASA/CPUTR exposure, plus a trust hit if a buyer checks |
| LCP (mobile lab) | 3.08 s | Fails "good"; 96% is render delay from one blocking stylesheet |

The biggest single lever is a deploy. Roughly half of the audit's high-severity findings are already fixed on disk.

## 2. Target queries and which page must win them

| Query cluster | Intent | SERP winners today | BacLab page that must win | Status |
|---|---|---|---|---|
| bacteriostatic water uk / buy bacteriostatic water / bacteriostatic water 10ml | Transactional | Single-vendor product pages | `/` | Aligned; under-armed on trust |
| bacteriostatic water vs sterile water (and vs saline / sodium chloride) | Comparison | 1,100–1,500-word articles (uk-peptides blog has ~55k views) | `/guides/bacteriostatic-water-vs-sterile-water` | Written, not deployed |
| what is bacteriostatic water | Informational | Explainer articles | `/guides/what-is-bacteriostatic-water` | Written, not deployed |
| how long does bacteriostatic water last / storage | Informational | Storage and stability guides | Two guides in tree | Written, not deployed |
| bacteriostatic water 100 vials / bulk / wholesale | Transactional long-tail | Tiered product pages | `/guides/bacteriostatic-water-vial-sizes` + `/#buy` | Written; wholesale path still dead-ends |
| bacteriostatic water safety data sheet / SDS | Reference | Per-product SDS pages | `/safety-data-sheet` | Written, not deployed |
| where to buy bacteriostatic water uk | Commercial investigation | Vendor pages and roundups | `/guides/where-to-buy-bacteriostatic-water-uk` | Written, not deployed |

---

## 3. The plan, in order

Each item lists the owner, the finding it closes, and how to verify it shipped. "Operator" means a fact only the business can supply.

### Phase 0 — Deploy what exists (this week, one day)

The audit was run against production, which is behind `main` and the working tree. Nothing else in this plan can be measured until this lands.

| # | Action | Owner | Closes | Verify |
|---|---|---|---|---|
| 0.1 | Commit the working tree and deploy. Purge Cloudflare cache after. | Dev | technical Critical (llms.txt), technical High (sitemap lastmod), schema High ×3 (image, url, breadcrumbs), ecommerce Critical (image), ecommerce Medium (guides hub), geo Critical | `curl -s https://baclab.co.uk/llms.txt \| grep 5.99`; `curl -s https://baclab.co.uk/sitemap.xml \| grep -c '<url>'` returns 24; Rich Results Test on `/` shows Product with image |
| 0.2 | Submit the new sitemap in Search Console and request indexing on the six guides and `/faq`. | Dev | ecommerce Medium | GSC "Pages" report shows 24 discovered within a week |
| 0.3 | Post-deploy spot check on every new URL: self-canonical, `index, follow`, breadcrumb JSON-LD, no therapeutic framing. | Dev | sitemap Info (TOP_LEVEL process risk) | One curl per URL, or the drift baseline once Python 3.10+ is installed |

### Phase 1 — Fix what is false or missing about the business (weeks 1–2)

These are the cheapest, highest-leverage changes in the audit. All five personas lose most of their points on trust, and two of the items are legal exposures rather than SEO polish.

| # | Action | Owner | Closes | Verify |
|---|---|---|---|---|
| 1.1 | **Resolve the "Cheapest in the UK" claim.** Recommended: change `LOWEST_PRICE_BADGE` in `config/funnel.ts` to price-match wording ("UK price match guarantee") so the claim is true by mechanism, not by a 4p margin that a competitor can erase overnight. Alternative if the superlative is worth keeping: reprice the single vial to £5.89 or below and diarise a monthly competitor check. | Operator decides, Dev ships | ecommerce Critical, sxo Low | All four surfaces (hero trust bar, purchase block, comparison caption, closing CTA) render the new copy |
| 1.2 | **Populate trader identity** in `config/brand.ts`: legal name, company number, registered address (structured `postalAddress` too), VAT number if registered. If BacLab is a sole trader, say so plainly in the same fields. | Operator supplies, Dev ships | content High, ecommerce High, sxo High, geo High | Footer, `/contact`, `/terms` §1 and the Organization JSON-LD all show it; UK Ecommerce Regs 2002 reg. 6 satisfied |
| 1.3 | **Add `sameAs`** to `config/brand.ts` once 1.2 exists: the Companies House URL qualifies on its own. Add Trustpilot or Google Business only when the profiles are live. | Operator | geo High, schema Info | Organization JSON-LD carries `sameAs` |
| 1.4 | **Set `DELIVERY.dispatchLine`** (for example "Dispatched same working day for orders before 2pm") so `deliveryTime` can be added to `shippingDetails` from a real fact. | Operator supplies, Dev ships | schema Medium (shippingDetails) | Home page delivery copy and `OfferShippingDetails.deliveryTime` agree |
| 1.5 | **Expand `/contact`** with response time, pre-sale vs post-sale scope, and the trader details from 1.2. | Dev | content Low | Page has 3+ unique paragraphs |
| 1.6 | **Wholesale enquiry link** directly under the bundle selector, pointing at `/contact` with a pre-filled subject. | Dev | sxo Medium, ecommerce (bulk persona) | Link visible without opening the FAQ |

### Phase 2 — Technical and schema polish (weeks 2–3)

| # | Action | Owner | Closes | Verify |
|---|---|---|---|---|
| 2.1 | **Bound HTML caching.** Add a Cloudflare Cache Rule that bypasses `text/html`, or set `s-maxage=300, stale-while-revalidate=86400` on the store pages. Add a cache purge to the deploy script. | Dev / Cloudflare | technical High | `curl -D -` on `/` shows the new header; a price change in config is live within minutes of deploy |
| 2.2 | **301 `www` to apex** at Cloudflare (redirect rule) unless `www` is deliberately a referral host, in which case document that in `lib/site-url.ts`. | Cloudflare | technical Medium | `curl -I https://www.baclab.co.uk/` returns 301 to apex |
| 2.3 | **`noindex, nofollow` on `/admin/login`** via page metadata plus an `X-Robots-Tag` header. | Dev | technical Medium | `curl -s https://baclab.co.uk/admin/login \| grep robots` shows noindex |
| 2.4 | **Turn off Cloudflare Email Address Obfuscation** for the zone, or render the address as plain text alongside the link. | Cloudflare | technical Medium, content Medium | `grep -c 'mailto:' raw HTML` is non-zero |
| 2.5 | **Per-offer `sku`** (from `BUNDLES[].sku`) and **`priceValidUntil`** (rolling 60 days from build) on every Offer; **`dateModified`** on Product from a real source. | Dev | ecommerce High, ecommerce Medium, geo Low | Rich Results Test shows eight distinct SKUs |
| 2.6 | **Per-page Open Graph** title and description on the legal, contact, FAQ, calculator and SDS pages, mirroring their unique `<title>`. | Dev | content Low | Each page's `og:title` differs from home |
| 2.7 | **LCP under 2.5 s.** Inline critical CSS for nav plus hero and defer the rest of the 14 KB stylesheet; move the hero to `next/image` with `sizes` so a phone fetches a ~564 px variant (31 KB saved); content-hash or `immutable` the hero asset. Re-run Lighthouse; check the sticky buy bar for scroll-triggered layout shift. | Dev | performance High, performance Medium ×2, technical Low | Lighthouse mobile LCP < 2.5 s; CrUX field data once an API key is configured |
| 2.8 | **Icons and manifest**: `app/apple-icon.png`, `app/manifest.ts` with theme colour `#0047FF`. | Dev | technical Low | `/apple-icon.png` returns 200 |
| 2.9 | **Deduplicate JSON-LD** from the RSC flight payload (~5 KB) if `JsonLd.tsx` can emit server-only script tags. Low priority. | Dev | performance Low | HTML size drops by ~5 KB |

### Phase 3 — Content, E-E-A-T and on-page depth (weeks 3–8)

The guides hub closes the page-type mismatch. This phase makes it competitive rather than merely present.

| # | Action | Owner | Closes | Verify |
|---|---|---|---|---|
| 3.1 | **About / sourcing page** (`/about`): who runs BacLab, manufacturer and fill site if disclosable, QC regime, how a certificate of analysis is supplied per batch. Only claims that can be evidenced. Link it from footer and Organization JSON-LD. | Operator supplies facts, Dev ships | content High, sxo High, geo (authority 35/100) | Page exists; Organization JSON-LD has `description` and `foundingDate` if true |
| 3.2 | **Sample certificate of analysis** as a downloadable PDF, or a batch-testing statement, linked from the hero trust bar and the SDS page. Competitor leads with a COA selector. | Operator | content High, sxo High | Link present; PDF returns 200 |
| 3.3 | **Home page: one 150-word citable explainer** under the H1 (definition, preservative mechanism, "not a steriliser", laboratory use only) and open the first FAQ item by default. Consider H1 "Buy bacteriostatic water — sealed 10ml vials" to carry the title's modifiers. | Dev | geo Low, geo Medium, sxo Medium, content Info | Paragraph is in the raw HTML above the bundle selector |
| 3.4 | **Technical data table** on the home page (CAS 7732-18-5 water, CAS 100-51-6 benzyl alcohol, 0.9% w/v, pH range once confirmed, storage temperature, shelf life, 28-day in-use limit) fed from `content/facts.ts`. `TechnicalData.tsx` exists in tree; confirm it renders. | Dev | competitor gap (uk-peptides has one) | Table present in raw HTML |
| 3.5 | **Guide depth pass.** Bring the comparison guide and "what is" guide to 1,200–1,500 words with question-form H2s, a visible "Updated" date, Article + FAQPage schema (already wired in `lib/guide-seo.ts`), and a link to `/#buy` and to each sibling guide. Author as the Organization unless a named, credentialled person is willing to be published. | Dev / copy | sxo Critical, content High (experience signals) | Each guide has 6+ H2s, FAQ block, and 3+ internal links |
| 3.6 | **Internal linking matrix**: home explainer → comparison guide; comparison guide → storage guide → vial-sizes guide → `/#buy`; FAQ answers link to the guide that expands them; SDS ↔ technical data table. | Dev | sxo, geo structural readability | Every guide has inbound links from at least two other pages |
| 3.7 | **FAQPage schema on `/disclaimer` and `/returns`**, since both already read as Q&A. | Dev | content Info, geo Info | Rich Results Test validates |
| 3.8 | **New guide candidates for months 2–3** (research register only): "How many draws can you take from a 10ml vial", "Benzyl alcohol 0.9% w/v explained", "Bacteriostatic water shelf life after opening", "Is bacteriostatic water a medicine in the UK". Each must have its own SERP that is not owned by product pages. | Copy | Content 58 → 75 target | One new guide every two weeks |

### Phase 4 — Off-site authority and reviews (months 2–6)

The domain has zero cross-site corroboration. On-page work alone will plateau against a 2012-vintage competitor.

| # | Action | Owner | Closes | Verify |
|---|---|---|---|---|
| 4.1 | **Verified reviews.** Set up Trustpilot or Google Business and a post-delivery review request in the existing nudge cron. Wire real reviews into `config/reviews.json`; never fabricate. | Operator + Dev | geo Medium, sxo High, ecommerce | `AggregateRating` appears only once 5+ genuine reviews exist |
| 4.2 | **Entity footprint**: Companies House listing (from 1.2), a LinkedIn company page, a Crunchbase-style listing. Each goes into `sameAs`. | Operator | geo High | 3+ `sameAs` entries |
| 4.3 | **Link acquisition** from UK laboratory-supply directories, university procurement resource lists, and research-consumables roundups. The SDS and comparison guide are the linkable assets. Avoid peptide-community sites entirely; they reinforce the Merchant Center risk. | Operator / outreach | Domain authority baseline 0 | 5 referring domains in 3 months, 15 in 6 |
| 4.4 | **Merchant Center policy pre-check** before any Shopping or Performance Max spend. Treat approval as provisional. Keep the site free of reconstitution, dosing or injection language. | Operator | ecommerce High | Written policy-support response on file |

### Phase 5 — Measure and iterate (ongoing)

| # | Action | Owner |
|---|---|---|
| 5.1 | Search Console: track the seven query clusters in section 2, the Product rich-result report, and the Merchant listings report. | Dev |
| 5.2 | Configure a PageSpeed / CrUX API key so the next audit has field data. | Dev |
| 5.3 | Install Python 3.10+ (`brew install python@3.12`) so the render, drift-baseline and report scripts run; capture a drift baseline after Phase 2. | Dev |
| 5.4 | Re-audit after Phase 1 and after Phase 3. Content and SXO scores should move most. | Dev |
| 5.5 | Monthly competitor price check against uk-peptides.com and the other eight vendors in the SXO SERP list, so 1.1 stays true. | Operator |

---

## 4. Targets

| Metric | Baseline (8 Sep 2026) | After Phase 2 (~4 weeks) | After Phase 3 (~8 weeks) | 6 months |
|---|---|---|---|---|
| SEO health score | 66 | 78 | 85 | 88+ |
| Indexed URLs | 6 | 24 | 30 | 35+ |
| Product rich result | Not eligible | Eligible, showing image | Showing shipping and returns chips | Showing rating |
| LCP (mobile) | 3.08 s lab | < 2.5 s lab | < 2.5 s field | Stable |
| Content score | 58 | 65 | 78 | 82 |
| SXO trust dimension | 10 / 25 avg | 17 / 25 | 20 / 25 | 22 / 25 |
| Ranking: comparison query | Not ranking | Indexed | Top 10 | Top 3 |
| Ranking: "buy bacteriostatic water uk" | Unknown (no GSC data yet) | Tracked | Top 5 | Top 3 |
| Referring domains | ~0 | 1 (Companies House) | 5 | 15 |

## 5. Dependencies and risks

- **Operator facts gate Phase 1.** Legal name, address, dispatch line, and any COA or manufacturer detail cannot be invented. Until supplied, those surfaces stay blank by design.
- **The superlative decision (1.1) is a business call.** The plan proceeds either way, but the current copy is contradicted by a live competitor price today.
- **Merchant Center is a category risk, not a page risk.** The wider market pairs this product with injectable peptides. Content discipline reduces but does not remove it. Do not let guide topics drift toward reconstitution or dosing to chase competitor traffic.
- **Cache headers are safe by accident.** The 1-year `s-maxage` is inert only because Cloudflare currently returns DYNAMIC. Item 2.1 makes that explicit before any Cloudflare change can serve year-old prices.
- **Concurrent sessions edit this repo.** Check `git status` and ListAgents before touching shared files such as `config/funnel.ts`, `config/brand.ts` and `app/sitemap.ts`.

## 6. Finding-to-action index

| Finding (file, severity) | Action |
|---|---|
| technical Critical — stale llms.txt | 0.1 |
| technical High — sitemap lastmod | 0.1 |
| technical High — s-maxage 1 year | 2.1 |
| technical Medium — www 200 | 2.2 |
| technical Medium — admin/login indexable | 2.3 |
| technical Medium — email obfuscation | 2.4 |
| technical Medium — Product image, breadcrumbs | 0.1 |
| technical Low — hero srcset, icons | 2.7, 2.8 |
| content High — trader identity | 1.2 |
| content High — no About / experience signals | 3.1, 3.2 |
| content Medium — obfuscated email | 2.4 |
| content Low — duplicate OG, thin contact | 2.6, 1.5 |
| content Info — H1 modifiers, FAQPage on legal pages | 3.3, 3.7 |
| schema High ×3 — image, url, BreadcrumbList | 0.1 |
| schema Medium — return policy, shippingDetails | 0.1 (shipped in tree), 1.4 |
| schema Low — itemCondition | 0.1 |
| sitemap Info — TOP_LEVEL process risk | 0.3 |
| performance High — LCP render delay | 2.7 |
| performance Medium — blocking CSS, hero size | 2.7 |
| performance Low — duplicate JSON-LD | 2.9 |
| geo Critical — llms.txt | 0.1 |
| geo High — no sameAs / legal entity | 1.2, 1.3, 4.2 |
| geo Medium — no reviews, declarative headings | 4.1, 3.3, 3.5 |
| geo Low — no citable passage, no dateModified | 3.3, 2.5 |
| sxo Critical — comparison page-type mismatch | 0.1, 3.5 |
| sxo High — no trust signals | 1.2, 3.2, 4.1 |
| sxo Medium — wholesale dead-end, jargon hero | 1.6, 3.3 |
| ecommerce Critical — no image | 0.1 |
| ecommerce Critical — false superlative | 1.1 |
| ecommerce High — Merchant Center category risk | 4.4 |
| ecommerce High — priceValidUntil | 2.5 |
| ecommerce High — shipping/returns schema | 0.1 |
| ecommerce High — legal identity | 1.2 |
| ecommerce Medium — per-offer SKU, guides hub | 2.5, 0.1 |
| ecommerce Low — per-bundle stock | Not scheduled; revisit when wholesale volume makes stock-outs plausible |
