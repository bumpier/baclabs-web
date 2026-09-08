# Structured data audit — baclab.co.uk

Scope: `application/ld+json` blocks extracted directly from `raw/home.html`, `raw/returns.html`, `raw/contact.html`,
`raw/terms.html`, `raw/privacy.html`, `raw/disclaimer.html` (live, fetched 2026-09-08), cross-checked against the
generating source (`app/layout.tsx`, `app/(store)/page.tsx`, `lib/seo.ts`, `components/JsonLd.tsx`, `config/brand.ts`,
`config/funnel.ts`, `config/faq.ts`, `components/LegalPage.tsx`, and the four legal page files + `contact/page.tsx`).

**Important context that shapes every finding below:** `git status` shows `app/(store)/page.tsx`, `app/layout.tsx`,
`app/(store)/contact/page.tsx`, `components/LegalPage.tsx`, and the four legal pages under `app/(store)/` are all
**modified but uncommitted**, and `components/JsonLd.tsx` / `lib/seo.ts` are **new, untracked** files. The raw HTML in
`raw/` — i.e. what Google and any visitor actually sees today — reflects the **old, deployed** code, not the
working tree. Several of the gaps found in the live markup are already fixed correctly in the working tree; those
are called out as "fix already written, not yet deployed" rather than re-specified from scratch.

---

## Detection summary (live, from `raw/*.html`)

| Page | Blocks found | Types |
|---|---|---|
| `/` (home.html) | 3 | `Organization`, `Product`, `FAQPage` |
| `/returns` | 1 | `Organization` |
| `/contact` | 1 | `Organization` |
| `/terms` | 1 | `Organization` |
| `/privacy` | 1 | `Organization` |
| `/disclaimer` | 1 | `Organization` |

All 8 blocks are syntactically valid JSON (verified with `JSON.parse`), use `"@context": "https://schema.org"` (not
`http`), and contain no placeholder text. **No `BreadcrumbList` block exists on any live page**, and no
`MedicalEntity`, `Drug`, `DietarySupplement` or similar medical type appears anywhere in the repo or the live markup.

---

## Findings

**[High] Live Product schema has no `image` — ineligible for Google's Product rich result / Merchant listing**
- Location: `raw/home.html`, `Organization`→`Product` block (block 2).
- Issue: The deployed `Product` JSON-LD has no `image` property at all. Google will not show a Product rich result
  (or Merchant Center-linked listing) without at least one image. Evidence: full block dumped from `raw/home.html`
  contains only `@context, @type, name, description, sku, brand, offers` — no `image`, no top-level `url`.
- Root cause / status: **Already fixed in the working tree, not yet deployed.** `app/(store)/page.tsx` (uncommitted)
  now does `...(PRODUCT_IMAGES.length > 0 ? { image: PRODUCT_IMAGES.map(i => \`${SITE}${i.src}\`) } : {})`, and
  `config/funnel.ts` now defines one real image (`/bacteriostatic-water-10ml-vial-uk.webp`, confirmed present at
  `public/bacteriostatic-water-10ml-vial-uk.webp` per the `git status` rename). Ship this deploy.
- Fix (for confirmation — this is what the next deploy will emit): add `"image": ["https://baclab.co.uk/bacteriostatic-water-10ml-vial-uk.webp"]` to the `Product` object.

**[High] Live Product schema has no top-level `url`**
- Location: `raw/home.html`, `Product` block.
- Issue: Per-offer `url` is present (`https://baclab.co.uk/#buy`) but the `Product` itself has no `url`. Not strictly
  required by Google, but recommended so the entity resolves to a canonical page independent of any one offer.
- Status: Already fixed in the uncommitted `app/(store)/page.tsx` (`url: SITE` added directly under `Product`). Ship
  with the same deploy as above.

**[High] `BreadcrumbList` is completely absent from all six live pages**
- Location: `/`, `/returns`, `/contact`, `/terms`, `/privacy`, `/disclaimer` — none carry a `BreadcrumbList` block.
- Issue: Interior pages (`/returns`, `/contact`, `/terms`, `/privacy`, `/disclaimer`) have no breadcrumb markup, so
  Google cannot show a breadcrumb trail in the SERP snippet for them, and there is no machine-readable Home→Page
  relationship anywhere on the site.
- Status: **Fix already written, not deployed.** `lib/seo.ts` (new, untracked) exports `breadcrumbSchema(name, path)`
  producing a 2-item `ItemListElement` (`Home` → page). It is wired into `components/LegalPage.tsx` (used by all four
  legal pages, each passing its own `path` prop — verified `/returns`, `/disclaimer`, `/terms`, `/privacy` all pass
  distinct correct paths) and directly into `app/(store)/contact/page.tsx`. The home page itself correctly has no
  `BreadcrumbList` (it is the root, position 1 with no parent — appropriate). Once deployed this closes the gap
  entirely. No further code change needed; verify post-deploy that the block actually renders (see validation below).

**[Medium] `hasMerchantReturnPolicy` missing from Product schema — a real, single 14-day policy exists but is not exposed to Google**
- Location: `Product` block (both live and pending source) has no `hasMerchantReturnPolicy`. `/returns` (`app/(store)/returns/page.tsx`) has a genuine, specific policy: 14-day statutory cancellation right under the Consumer Contracts Regulations 2013, with a sealed-goods exception (reg. 28(3)(b)) — a vial with an intact seal is returnable, an opened one is not.
- Issue: Google's Merchant return policy schema has no clean field for "returnable only if seal/tamper-evidence intact," so encoding the exception literally would misstate the policy. The safest correct approach is a **finite return window** declaration that points to the actual policy page rather than trying to over-specify conditions schema.org cannot express.
- Fix (add to the `Product` object, alongside `offers`):
```json
{
  "hasMerchantReturnPolicy": {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "GB",
    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
    "merchantReturnDays": 14,
    "returnMethod": "https://schema.org/ReturnByMail",
    "returnPolicyUrl": "https://baclab.co.uk/returns"
  }
}
```
  `returnFees` is intentionally omitted here — confirm with the operator who bears return postage cost before adding
  `returnFees: FreeReturn` or `ReturnShippingFees`; do not guess, consistent with this codebase's own "omit rather
  than fabricate" convention (see `config/brand.ts` comments).

**[Medium] No `shippingDetails` (OfferShippingDetails) on any Offer**
- Location: `Product.offers[]`, both live and pending.
- Issue: A real, specific delivery policy exists in `config/funnel.ts` (`DELIVERY`: `mode: "threshold"`, `priceMinor:
  200`, `freeFromMinor: 3000` → £2 UK delivery, free at £30+) but it is not exposed as `shippingDetails`, so Google
  cannot show a shipping estimate in the Merchant listing / Product snippet.
- Fix — add to each `Offer` (values shared across all 8 tiers since delivery rule is uniform; a single vial at
  £5.99 does not clear the £30 free threshold, so that tier shows the flat rate, while the £34.99+ tiers would
  legitimately show `"FreeShipping"` — the simplest and equally valid option is one `shippingDetails` block per
  offer using the £2 rate, since Google evaluates cart total dynamically only via the higher-precision `OfferShippingDetails.doesNotShip`/rate fields, not per-SKU threshold logic; recommend the flat non-threshold form shown below and let the free-over-£30 saving surface via the visible on-page copy, which it already does):
```json
{
  "shippingDetails": {
    "@type": "OfferShippingDetails",
    "shippingRate": { "@type": "MonetaryAmount", "value": "2.00", "currency": "GBP" },
    "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "GB" },
    "deliveryTime": {
      "@type": "ShippingDeliveryTime",
      "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
      "transitTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 3, "unitCode": "DAY" }
    }
  }
}
```
  `handlingTime`/`transitTime` values above are placeholders bracketing typical UK second-class post — **do not ship
  these exact numbers**; `DELIVERY.dispatchLine` in `config/funnel.ts` is currently `""` (empty/unset), so there is no
  authored dispatch-time fact to draw from yet. Populate `dispatchLine` first, then derive the schema numbers from it,
  per the same source-of-truth principle the codebase already uses for price and delivery-threshold copy.

**[Info] `FAQPage` on `/` — no Google SERP benefit; visible-content match is correct if kept**
- Location: `raw/home.html` block 3, sourced from `config/faq.ts` → `FAQ_PUBLISHABLE` (all 11 items, unfiltered since
  none currently carry a `todo`).
- Google retired FAQ rich results for all sites (superseding the Aug 2023 gov/health-only restriction); this markup
  will not produce a SERP feature. Any AI/GEO summarization benefit is unconfirmed. Downgraded to Info per policy —
  not a defect, just no longer an SEO lever.
- Positive finding worth keeping on record: every one of the 11 `Question`/`Answer` pairs in the JSON-LD was verified
  present verbatim in the page's non-script text (checked via string search against the script-stripped HTML,
  including the two that are easy to typo when hand-authored: "Does bacteriostatic water sterilise a contaminated
  vial?" and "Why is a single vial £5.99 but the packs cost less per vial?"). If FAQPage is kept for AI/GEO reasons,
  this hygiene is correct and should be preserved — do not let the visible accordion and `config/faq.ts` drift apart.
- No `QAPage` is present or needed here; this is authored FAQ copy, not user-submitted Q&A, so `FAQPage`'s general
  shape is the right one regardless of its SERP status.

**[Info] `Organization` schema has no `sameAs`**
- Location: all 6 pages, `Organization` block (identical on every page, emitted once from `app/layout.tsx`).
- No social/profile URLs are configured anywhere in `config/brand.ts`, so there is nothing to add without inventing
  URLs. Only actionable if the operator has real, live social profiles for BacLab — add `"sameAs": ["<url>", ...]`
  then, not before.

**[Info] `Organization.legalName`/`vatID` conditional logic is correct and currently inert**
- Location: `app/layout.tsx` lines 78–98.
- `brand.company.legalName` and `brand.company.vatNumber` are both `""` in `config/brand.ts`, so `name` correctly
  falls back to `"BacLab"`, `alternateName` and `vatID` are correctly omitted (not emitted as empty strings) —
  confirmed by their absence in every live `Organization` block. No action needed; flagging only so a future PR that
  fills in `legalName`/`vatNumber` doesn't need to touch this logic, it already does the right thing.

**[Low] `Offer.itemCondition` missing from live offers (fix already written, not deployed)**
- Location: `raw/home.html`, each of the 8 `Offer` objects.
- Live offers carry `name`, `price`, `priceCurrency`, `url`, `availability` but no `itemCondition`. The uncommitted
  `app/(store)/page.tsx` adds `"itemCondition": "https://schema.org/NewCondition"` to every offer — correct, ship it.

---

## Validation checklist results

| Check | Result |
|---|---|
| `@context` is `https://schema.org` (not `http`) | Pass — all 8 blocks |
| `@type` valid, not deprecated (no HowTo/SpecialAnnouncement/CourseInfo etc.) | Pass |
| No `FAQPage`-as-panacea assumption — flagged as Info, not Critical, per current Google policy | Pass (correctly scoped) |
| No `MedicalEntity`/`Drug`/`DietarySupplement`/`MedicalWebPage` anywhere in repo or live markup | Pass — grep across `.ts`/`.tsx` returned zero matches; product is consistently framed as a laboratory/research diluent in both copy and schema, matching the compliance requirement in `config/brand.ts`'s `disclaimer` field |
| `Product.image` present | **Fail (live)** / Pass (pending, undeployed) |
| `Product` required offer fields (`price`, `priceCurrency`, `availability`, `url`) | Pass — present on all 8 offers, live and pending |
| `hasMerchantReturnPolicy` | Fail — missing (see Medium finding) |
| `shippingDetails` | Fail — missing (see Medium finding) |
| `aggregateRating`/`review` absent while no real reviews exist | Pass — correctly gated behind `HAS_REVIEWS`/`config/reviews.json`, which ships empty; no fabricated ratings |
| `gtin`/`mpn` | Not applicable — single-brand, non-GTIN-registered product; omission is correct, not a defect |
| `BreadcrumbList` on interior pages | **Fail (live)** / Pass (pending, undeployed) |
| URLs absolute, not relative | Pass — every `url`, `logo`, `image` in every block resolves through `canonicalOrigin()`/`SITE` to an absolute `https://baclab.co.uk/...` URL |
| Dates ISO 8601 | Pass — no dates in current live schema (no `Review.datePublished` since `HAS_REVIEWS` is false); `config/reviews.json`'s `isReview()` validator already enforces `YYYY-MM-DD` for whenever reviews are added |
| No placeholder text (`[Business Name]` etc.) | Pass |
| Meta description price vs schema price | Pass — meta description quotes `£5.99` and `£2.75` (lowest per-vial); both figures appear verbatim in the `Product` schema's offers (`5.99` unit offer, `274.99`/100 = `2.75` for the 100-vial tier) |
| Visible on-page price vs schema price | Pass — all 8 schema prices (`5.99, 21.99, 25.89, 29.49, 34.99, 64.99, 149.99, 274.99`) were found present in the script-stripped visible HTML of `home.html`, each at least once |
| JSON-LD is syntactically valid | Pass — all 8 blocks parse cleanly with `JSON.parse` |

---

## Score: 61 / 100

Scored against the **live** site (`raw/*.html`), since that is what is currently indexed and eligible for rich
results — not the uncommitted working tree. The two highest-impact gaps (`Product.image` absent → no Product rich
result eligibility at all today; `BreadcrumbList` absent site-wide) are both already fixed correctly in the
uncommitted source and only need a deploy to close — that's the fastest path to a materially higher score. The
remaining structural gaps (`shippingDetails`, `hasMerchantReturnPolicy`) need one real fact each (a dispatch-time
line, and a decision on who pays return postage) before they can be added without guessing, in keeping with this
codebase's own no-placeholder convention.

**What works:** JSON-LD is 100% valid, uses `https://schema.org`, absolute URLs throughout, and is scrupulously
honest — `AggregateRating` and fabricated reviews are correctly withheld, the FAQPage content is verified to match
visible page text exactly, and there is zero medical/therapeutic schema anywhere, consistent with the product's
lab-reagent-only positioning. The Organization block is identical and correctly deduplicated across all 6 pages, and
its conditional `legalName`/`vatID`/`contactPoint` logic is already built for a future rebrand without needing
placeholder values today.
