# E-commerce SEO audit — baclab.co.uk

Data sources: On-page analysis (static) against `raw/home.html` (production, fetched 2026-09-08) plus current repo source (`config/funnel.ts`, `app/(store)/page.tsx`, `components/funnel/PurchaseBlock.tsx`, `lib/product-schema.ts`, `content/facts.ts` — read-only, some of it uncommitted/in-progress and not yet deployed, noted explicitly below where relevant). DataForSEO Merchant API was not called: this environment has no Python 3.10+ runtime for the plugin scripts (per BRIEF.md), so no live marketplace/SERP pull was made. A real UK competitor snapshot exists at `competitor-profiles/uk-peptides.md` and `competitor-profiles/raw/uk-peptides/2026-09-08/scrapes/bacteriostatic-water-product.txt` (scraped the same day) and is used below in place of a Merchant API call for pricing/positioning comparison — flagged inline as "competitor scrape" rather than "DataForSEO Merchant (live)".

---

## [CRITICAL] Product JSON-LD on the live site has no `image` — Google will not build a Product rich result or free listing from it today

**Location**: `raw/home.html`, second `<script type="application/ld+json">` block (the `Product` node); source `app/(store)/page.tsx`.

**Issue (evidence)**: The deployed Product schema has no `image` key at all — verified by parsing the live JSON-LD (`node -e "JSON.parse(...).includes('image')"` → `false`). Google's own documentation states a Product rich result will not render without `image`. The page's `<img>` tag still points at the *old* filename, `/bacteriostatic-water-10ml-research-vial-uk-astra-labs.webp`, which git status shows was renamed to `/bacteriostatic-water-10ml-vial-uk.webp` in an uncommitted change — production has neither the renamed asset reference nor an `image` field in structured data. The current repo source (`app/(store)/page.tsx`) already conditionally spreads `PRODUCT_IMAGES` into the schema (`...(PRODUCT_IMAGES.length > 0 ? { image: ... } : {})`), so this looks like a fix that exists locally but has not shipped.

**Fix**: Deploy the current source so `image` is emitted (it will resolve to `https://baclab.co.uk/bacteriostatic-water-10ml-vial-uk.webp` once the renamed asset is live). Confirm with the Rich Results Test post-deploy. Until this ships, the product is invisible to Google Shopping's free listings and to Product rich results, regardless of any other schema completeness.

---

## [CRITICAL] "Cheapest in the UK" is an unqualified superlative that is not currently true at the entry price point

**Location**: `config/funnel.ts` (`LOWEST_PRICE_BADGE = "Cheapest in the UK"`), rendered on 4 surfaces — hero, trust bar (`components/funnel/TrustBar.tsx`), `PurchaseBlock.tsx` (bottom of the purchase panel, linked to `#guarantee`), and the final CTA in `app/(store)/page.tsx`.

**Issue (evidence)**: `PRODUCT.unitPriceMinor = 599` → single vial is £5.99. The competitor scrape at `competitor-profiles/raw/uk-peptides/2026-09-08/scrapes/bacteriostatic-water-product.txt` shows uk-peptides.com selling the identical product ("10ml Bacteriostatic Mixing Water") at **£5.95** for a single vial — 4p cheaper than BacLab's entry price, from a real, identifiable, currently-trading UK seller. The code comment in `config/funnel.ts` explicitly acknowledges this is a bare superlative whose burden of substantiation sits with the seller under CPUTR/the DMCC Act, and relies entirely on the price-match guarantee to carry it — but the guarantee is reactive (a customer has to find and report the cheaper listing) while the claim is asserted unconditionally, sitewide, today. This is not a hypothetical risk; it is a claim currently contradicted by an identifiable competitor's live price for the same pack size.

**Fix**: Either (a) drop the single-vial price to at or below £5.95 so the claim holds at every tier, not just in bulk where BacLab is genuinely far cheaper (100-pack: £2.75/vial vs uk-peptides' £4.00/vial at 100+), or (b) qualify the claim ("Best price on bundles of 5+" / restrict `LOWEST_PRICE_BADGE` to the tiers where it is actually true), or (c) re-run a real competitor price check immediately before re-enabling the bare form. Do not rely on the price-match guarantee alone to substantiate a claim that is checkable and currently false for one tier.

---

## [HIGH] Category policy risk: "bacteriostatic water" is systemically associated with injectable research-peptide reconstitution, a Google Merchant Center/Shopping trouble category

**Location**: Product category as a whole; not a fixable on-page item.

**Issue (evidence)**: The competitor scrape confirms the real-world commercial context for this exact SKU: uk-peptides.com sells the identical bacteriostatic water product as one line item inside a ~96-SKU catalogue of injectable "research peptides" (BPC-157, TB-500, PT-141/Bremelanotide, IGF-1 LR3, Tesamorelin, GHK-Cu, Semax, etc.), with a dedicated "Peptide Calculator" (a reconstitution/dosing tool) and cross-sell marquees linking bacteriostatic water to every peptide page. Google Ads/Merchant Center enforcement in this space (peptides, SARMs, unapproved injectables and their diluents) has a well-documented pattern of account-level suspension under "Dangerous products," "Healthcare and medicines," or "Restricted content" policies, and enforcement frequently keys off category/keyword association across the wider market rather than an individual seller's own disclaimer language. BacLab's own copy is already disciplined about this (strictly "laboratory and research diluent," explicit non-therapeutic disclaimer, no reconstitution dosing content) — but that discipline reduces risk, it does not eliminate it, because Google's classifiers and manual reviewers see the category, not just the page.

**Fix**: Do not budget for Shopping/Performance Max ads on this SKU without a Google Ads policy pre-check (Merchant Center's "Preview" tool, or direct policy support contact) — treat any campaign spend here as provisional until approved. For organic/free listings, keep the current framing exactly as strict as it is now (no peptide, dosing, reconstitution-ratio, or injection content anywhere on-site — the FAQ's "reconstitute or dilute substances for laboratory and research purposes" phrasing is the right register; do not let a future guides/calculator hub drift toward peptide-dosing use cases to chase the competitor's content, which would increase this exact risk). Surface this as a known, largely non-engineerable constraint to the business owner rather than a punch-list item.

---

## [HIGH] No `priceValidUntil` on any Offer

**Location**: `app/(store)/page.tsx` `productSchema.offers[]`; also absent from the newer `lib/product-schema.ts` helpers.

**Issue (evidence)**: None of the 8 offers (live or in the updated source) carry `priceValidUntil`. Google's Product structured-data guidelines list this as required once a price is stated, for full eligibility in the merchant listing experience (the "In stock · delivery · returns" enhanced snippet the competitor already shows — see next finding). Without it, Google can silently fall back to a stale cached price rather than trusting the page's stated price, and this becomes a bigger risk given `SALE.enabled = true` in config (currently suppressed on the front end because `referenceFrom` is null, but the underlying prices could change independent of that flag).

**Fix**: Add `priceValidUntil` to each Offer, e.g. a rolling near-future date computed at build/request time (30–90 days out) or tied to a real repricing review cadence. Keep it derived from config, not hand-typed, consistent with the rest of `funnel.ts`'s "nothing here can drift" pattern.

---

## [HIGH] Missing `shippingDetails` / `hasMerchantReturnPolicy` in the *live* schema — competitor already shows the enhanced SERP snippet this enables

**Location**: `raw/home.html` Product JSON-LD (neither field present, confirmed by grep); contrast with `lib/product-schema.ts` (`shippingDetailsFor`, `returnPolicySchema`) which exists in the current repo but is not yet deployed.

**Issue (evidence)**: `competitor-profiles/uk-peptides.md` records that uk-peptides.com's SERP snippet already shows "In stock · 1–8 day delivery · 14-day returns" — the Merchant Center enhancement that `OfferShippingDetails` + `MerchantReturnPolicy` structured data unlocks. BacLab's live schema has neither, so it cannot compete for that snippet real estate against a direct competitor who already has it, even though BacLab's actual delivery (£2, free ≥£30) and returns (14-day, sealed-goods exception) terms are perfectly capable of being represented.

**Fix**: Ship the `shippingDetailsFor()` / `returnPolicySchema()` work already present in `lib/product-schema.ts` — see the next finding for one accuracy issue to fix before it goes live.

---

## [MEDIUM] The in-progress `hasMerchantReturnPolicy` schema overstates the return policy — it doesn't carry the sealed-goods exception

**Location**: `lib/product-schema.ts` → `returnPolicySchema()`, consumed by `app/(store)/page.tsx` (`hasMerchantReturnPolicy: returnPolicySchema()` on every Offer); compare against the actual policy text on `/returns` (`app/(store)/returns/page.tsx`, "The exception for sealed goods").

**Issue (evidence)**: The schema declares `returnPolicyCategory: MerchantReturnFiniteReturnWindow`, `merchantReturnDays: 14`, `refundType: FullRefund`, unconditionally, for all 8 offers. The actual `/returns` page is explicit that this only holds for a vial "whose seal is intact" — a vial that has been opened, punctured, or had its tamper-evident seal broken **cannot** be returned or refunded, under reg. 28(3)(b) of the Consumer Contracts Regulations 2013. The developer's own comment in `config/funnel.ts` (the `RETURNS` block) already flags this: *"the sealed-goods exception cannot be expressed in schema and is left to the page."* Shipping this as-is means Google's merchant listing chip ("14-day returns" / "Free returns") will represent a broader promise than the site actually honours — a policy-mismatch risk with Merchant Center's return-policy accuracy requirements, and a potential CPUTR issue if a customer relies on the SERP chip over the small print.

**Fix**: Add a `description` (schema.org's generic `Thing` property, valid on `MerchantReturnPolicy`) stating the sealed-goods condition in plain language, e.g. "Applies to vials returned with the seal intact; opened vials cannot be returned." `merchantReturnLink` already points at `/returns`, which is good — keep it as the authoritative source, but don't let the machine-readable summary claim more than the linked page does.

---

## [HIGH] No company legal identity anywhere on the site

**Location**: `config/brand.ts` (`company.legalName`, `company.companyNumber`, `company.registeredAddress`, `company.vatNumber` — all `""`); reflected on `/contact`, `/terms`, `/privacy`, and the `Organization` JSON-LD (`raw/contact.html`, `raw/home.html`).

**Issue (evidence)**: Every legal/company-identity field is empty by design ("an unsupplied fact is left out of the sentence entirely"). The result: `/contact` offers only an email address, no phone, no postal address, no company number. The `Organization` schema on every page has `name`, `url`, `logo`, and a `contactPoint` email — no `address`, no legally-required company details for a limited company (if BacLab trades as one). This is both a UK trust-signal gap (a customer paying £275 for a 100-vial order via a site with no verifiable trading address) and a Merchant Center business-identity gap — Google's Shopping/Merchant Center policies expect a clear, verifiable business identity, and the direct competitor (`competitor-profiles/uk-peptides.md`) publishes exactly this: "Registered Office: 409 Linthorpe Road, Middlesbrough... Company No. 08033431 | VAT No. 271775577," plus `foundingDate` in its Organization schema.

**Fix**: Populate `brand.company` with the real registered details (or confirm BacLab trades as an unregistered sole trader and state that clearly instead — either is fine, an information vacuum is not). Add `address` to the `Organization` JSON-LD once available. This is a prerequisite the codebase itself already flags in `lib/legal.ts` as "outstanding before these pages are launch-ready" — treat it as launch-blocking for e-commerce trust, not optional polish.

---

## [MEDIUM] Bundle offers share one Product-level SKU; the 8 per-bundle SKUs that already exist in `funnel.ts` never reach the schema

**Location**: `app/(store)/page.tsx` — `productSchema.sku: "baclab-10ml"` (Product-level, singular) vs. `config/funnel.ts` `BUNDLES[].sku` (8 distinct values: `baclab-10ml-x1` … `baclab-10ml-x100`, already used for Stripe/packing slips).

**Issue (evidence)**: The `offers[]` array has 8 entries at 8 different prices for 8 genuinely different purchasable packs, but none carries its own `sku`, `gtin`, or `identifier`. Machine consumers (Google, price-comparison crawlers, a future Merchant Center feed) have no way to distinguish "the £21.99 offer" from "the £274.99 offer" except by parsing the free-text `name` field. The data already exists one file away.

**Fix**: Add `sku: b.sku` to each Offer in the map (`BUNDLES.map((b) => ({ ..., sku: b.sku }))`). Since there's no manufacturer GTIN for a private-label lab reagent, also set `identifier_exists: false`-equivalent guidance if this ever becomes a Merchant Center product feed (schema.org itself doesn't require this, but a future feed will).

---

## [MEDIUM] One-page structure: no indexable URL exists for pack-size long-tail queries, and the in-progress fix is not yet buildable

**Location**: `app/sitemap.ts` (`const TOP_LEVEL: MetadataRoute.Sitemap = []`); `components/funnel/LearnStrip.tsx` (imports `@/content/guides`, links to `/guides/[slug]`, `/calculator`, `/safety-data-sheet`).

**Issue (evidence)**: Only 6 URLs are indexable (home + 5 legal pages). All 8 bundle prices/vial-counts are present as real, crawlable text in the static HTML (confirmed: "100 vials Wholesale £2.75 per vial ... save £324.01 (54%) £274.99" is in `raw/home.html`'s server-rendered output, not client-only JS) — so the *content* for "bacteriostatic water 100 vials" exists, but there is no distinct URL, title, or heading Google can rank specifically for that query; everything resolves to the single homepage title ("Buy Bacteriostatic Water UK — 10ml vial, £5.99 | BacLab"), which centres the entry price, not the bulk/wholesale intent. The repo already has work under way to fix exactly this — `LearnStrip`, `TechnicalData`, `PriceLadder` components, and `app/(store)/guides/` — but as it stands today this would not build cleanly: `content/guides.ts` (imported by `LearnStrip.tsx`) does not exist anywhere in the repo, `app/(store)/guides/[slug]/` has no `page.tsx`, and `/calculator` and `/safety-data-sheet` have no route at all under `app/`. The competitor (`competitor-profiles/uk-peptides.md`) already runs a 19-post blog, a Storage & Stability guide, a 46-question FAQ hub, an SDS page, and a Peptide Calculator with `WebApplication` schema — this is the exact gap the in-progress work is aimed at closing.

**Fix**: Before shipping `LearnStrip`: create `content/guides.ts` (even a minimal registry), populate `app/(store)/guides/[slug]/page.tsx`, and either build `/calculator` + `/safety-data-sheet` or remove those two links until they exist — a homepage linking to two 404s is worse than not linking at all. Once live, add each guide/tool URL to `sitemap.ts`'s `TOP_LEVEL` (the file already has a comment reserving this: "Guides, FAQ, calculator and safety-data-sheet pages belong here once they exist"). This is the single highest-leverage long-tail SEO fix available and is already most of the way built.

---

## [LOW] `Offer.availability` is hardcoded `InStock` for all 8 packs; `STOCK_LEVEL` is a manual single global, not per-bundle

**Location**: `app/(store)/page.tsx` — `availability: STOCK_LEVEL === null || STOCK_LEVEL > 0 ? InStock : OutOfStock`; `config/funnel.ts` `STOCK_LEVEL: number | null = null`.

**Issue (evidence)**: `STOCK_LEVEL` is currently `null`, so every offer correctly shows `InStock` and no fabricated scarcity is shown (this is good — see "what works"). But it is one global figure, not tracked per bundle tier; if the 100-vial wholesale pack sells out while singles remain available, there is no mechanism to reflect that in either the UI or the schema without a code change.

**Fix**: Not urgent while stock is effectively unlimited/unmanaged, but worth flagging as an operational gap before wholesale volume makes stock-outs plausible — consider a per-bundle stock field if that becomes real.

---

## [INFO] FAQPage schema is unlikely to earn classic Google rich results, but is still worth keeping

**Location**: `app/(store)/page.tsx` `faqSchema`.

**Issue (evidence)**: Google restricted FAQ rich results (Aug 2023) to a narrow set of authoritative government/health sites; a commercial single-product store is very unlikely to see the accordion snippet in Search regardless of markup quality. This isn't a defect — the FAQ content itself is genuinely useful (chemistry/handling Qs, no therapeutic framing) and the schema helps AI answer engines (ChatGPT, Perplexity, Google AI Overviews, all explicitly allowed in `robots.ts`) parse it correctly. No action needed; don't expect a SERP snippet from it.

---

## What works

The pricing math is honest and holds up under scrutiny: every "save £X (Y%)" figure compares a bundle against the real, currently-purchasable single-vial price on the same page (not an inflated "was" price), and the sitewide 30%-off sale mechanism is correctly suppressed in production because `SALE.referenceFrom` is unset — the CMA reference-price guardrail (`mayShowReferencePrice()`) is doing its job. Reviews and stock-level claims are genuinely absent rather than fabricated, and all 8 bundle prices are server-rendered, crawlable plain text — the raw ingredients for good e-commerce SEO are already disciplined; they're mostly missing from the *schema* layer and the *content-hub* layer, both of which have real, if unfinished, work already under way in the repo.

**Score: 44/100**
