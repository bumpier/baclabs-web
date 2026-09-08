# baclab.co.uk — Full SEO Audit

Audited 2026-09-08 against the live site plus the uncommitted working tree in the repo. Eight specialist passes (technical, content/on-page, schema, sitemap, performance, AI search readiness, search experience, e-commerce). Per-category detail with evidence and code snippets is in `findings/`.

## Executive summary

**SEO Health Score: 66 / 100**  
Business type: single-product UK e-commerce funnel (laboratory/research diluent), Next.js App Router behind Cloudflare.

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 64 |
| Content quality | 23% | 58 |
| On-page SEO | 20% | 78 |
| Schema / structured data | 10% | 61 |
| Performance (lab, mobile) | 10% | 78 |
| AI search readiness | 10% | 58 |
| Images | 5% | 65 |
| *Supplementary: sitemap* | — | 94 |
| *Supplementary: search experience (SXO)* | — | 54 |
| *Supplementary: e-commerce* | — | 44 |

The single most valuable action is a deploy. The production build is behind `main` and the working tree: the live `/llms.txt` quotes £7.50 a vial and five bundles, the live sitemap carries a fake `lastmod`, the live Product schema has no `image`, and no interior page has breadcrumbs. Every one of those is already fixed in the repo.

### Top 5 critical / high issues

1. **Stale production deploy** — live `/llms.txt` misquotes price by ~25% to every AI crawler; live Product JSON-LD lacks `image` so it cannot earn a Product rich result; live sitemap has build-time `lastmod` on every URL. (technical, geo, schema)
2. **"UK's lowest price — guaranteed" is currently false at the entry price** — a competitor lists the identical 10ml vial at £5.95 against £5.99. The price-match mechanism softens this but a bare superlative on four surfaces is exposed under CAP/ASA pricing rules. (ecommerce, sxo)
3. **No trader identity anywhere** — no legal name, company number, VAT number or address on `/contact`, `/terms`, footer or Organization schema. `config/brand.ts` has the fields; they are empty. This is a UK consumer-law gap as much as an E-E-A-T one, and it drags trust scores for every persona. (content, sxo, ecommerce, geo)
4. **HTML served with `cache-control: s-maxage=31536000`** — safe today only because Cloudflare returns `cf-cache-status: DYNAMIC`. One cache rule change would serve year-old prices. (technical)
5. **No page for comparison intent** — "bacteriostatic water vs sterile water" is won by dedicated explainer articles; the site has no URL for it, so the comparison-stage researcher persona scores 42/100. (sxo, content)

### Top 5 quick wins

1. Deploy `main` plus the current working tree (fixes items in #1 above in one go).
2. 301 `www.baclab.co.uk` → apex at Cloudflare (currently 200 with only a canonical tag).
3. Populate `brand.company.*` (legal name, company number, registered address) and let the footer, `/contact`, `/terms` and Organization schema render it.
4. Serve the hero image at its displayed size (564×704 CSS px, currently 1122×1402 intrinsic) via `next/image` or a resized asset — ~31KB saved on the LCP path.
5. Push bundle-level SKUs from `config/funnel.ts` into each `Offer`; add `priceValidUntil`.

## Technical SEO (64)

- **[Critical] Stale `/llms.txt` in production.** £7.50/vial and five tiers vs live £5.99 and eight tiers. Fix is the untracked `app/llms.txt/route.ts`; deploy it.
- **[High] Sitemap `lastmod` = build timestamp on all 6 URLs.** Fixed in `app/sitemap.ts` (this session); deploy.
- **[High] `s-maxage=31536000` on HTML.** Add an explicit Cloudflare cache rule (bypass HTML) or lower the header for `/` where prices live. `/privacy` already uses `force-dynamic`/no-store deliberately and is correct.
- **[Medium] `www` host returns 200.** Add a Cloudflare redirect rule or DNS-level 301 to the apex.
- **[Medium] `/admin/login` inherits the home page title and `index, follow`.** Add `robots: { index: false }` in the admin login metadata; robots.txt is the only barrier now.
- **[Medium] Cloudflare email obfuscation** replaces every `mailto:` with `/cdn-cgi/l/email-protection`; raw HTML shows the literal `[email protected]`. Disable Email Address Obfuscation for this zone or render the address as text.
- **[Low] Hero is a plain `<img>`** with no `srcset` and a 4-hour cache; no `apple-touch-icon`, manifest or `favicon.ico`.
- **Works:** all six canonicals self-consistent to the apex; robots/sitemap scope exact; full SSR (bots see ~6.4KB of text with zero JS); true 404s; strong CSP, HSTS-preload, X-Frame-Options.

## Content quality (58) and on-page SEO (78)

- **[High] No trader identity** (see summary #3).
- **[High] No Experience/Authoritativeness signals** — no About page, no sourcing, QC or manufacturer detail, nothing independently verifiable.
- **[Medium] Contact email unreadable to non-JS crawlers** (obfuscation, above).
- **[Low] `og:title`/`og:description` identical on all six pages** — the home page copy leaks onto every legal page's social preview.
- **[Low] `/contact` is ~130 words, ~60% shared boilerplate.**
- **[Info] Home H1** is 48 characters, not over-long, but omits the "buy"/"UK" modifiers the title tag targets.
- **Works:** titles and descriptions unique and well scoped; keyword use natural (~0.8% density, no stuffing); descriptive anchors; legal pages substantive (919–2,547 words) with correct UK statute citations and current dates; therapeutic-claim discipline is consistent across footer, FAQ and Terms clause 8.

## Schema and structured data (61)

- **[High] Live Product has no `image`** — disqualifies the Product rich result. Fixed in working tree; deploy.
- **[High] `BreadcrumbList` absent on all five interior pages** — `breadcrumbSchema()` in `lib/seo.ts` exists but was never wired live. Fixed in working tree; deploy.
- **[High → resolved in tree] No `hasMerchantReturnPolicy` or `shippingDetails` live.** Since the snapshot, `lib/product-schema.ts` emits `MerchantReturnPolicy` (14-day window and customer-pays return postage read from the same RETURNS config as `/returns`, with the sealed-goods exception as `description`) and `shippingDetails` carrying only the rate Stripe charges. `deliveryTime` is deliberately omitted until handling/transit days are set in config. Snippets in `findings/schema.md` remain as reference; verify in Rich Results Test after deploy.
- **[Medium] No `priceValidUntil`; bundle SKUs not on Offers.**
- **[Info] FAQPage** no longer yields a SERP feature, but all 11 Q&As are present verbatim on the page, so it is safe to keep for AI citation.
- **Works:** valid JSON-LD on all six pages; no fabricated `AggregateRating`; no medical types anywhere; schema prices match visible and meta-description prices exactly.

## Performance (78, Lighthouse 13.4.1 lab, mobile)

| Metric | Value | Status |
|---|---|---|
| LCP | 3.08s | needs improvement |
| FCP | 2.4s | needs improvement |
| CLS | 0.0001 | good |
| TBT | 38ms | good |
| TTFB | 114ms | good |
| Lighthouse performance | 91 | — |

- **[High] LCP element is the H1 text, not the image**, and 96% of LCP (2,966ms) is element render delay. Prime suspect is the single render-blocking stylesheet (14KB, synchronous `<link>`) flagged by `render-blocking-insight`. Inline critical CSS or split the stylesheet.
- **[Medium] Hero image oversized** (1122×1402 for a 564×704 slot, ~31KB waste); loading hints are otherwise correct.
- **[Medium] HTML is 97.8KB, 46% of it inline RSC flight payload**, including ~5.3KB duplicate of the JSON-LD already emitted as script tags.
- **[Low] `StickyBuyBar.tsx`** (recently modified) unverified for CLS this pass.
- Field data (CrUX) unavailable: no API key and the keyless PageSpeed quota was exhausted.
- **Works:** fonts, DOM size (529), unused JS/CSS and main-thread work (0.6s) all clean.

## Images (65)

- Product schema `image` missing live (fixed in tree). Hero oversized and without `srcset`. Two `<img src="/logo.svg" alt="">` are treated as decorative, which is acceptable only if the brand name appears as adjacent text. Hero `alt` is descriptive and accurate. OG image is generated at 1200×630 with alt.

## AI search readiness (58)

- **[Critical] Live `/llms.txt` price drift** (above).
- **[High] Organization schema has no `sameAs` or legal entity data.**
- **[Medium] No reviews** (correctly not faked) so no trust signal; headings are declarative rather than question-form outside the FAQ.
- **[Low] No single ~150-word citable explainer passage; no `dateModified` on Product despite recent price changes.**
- **Works:** robots.txt explicitly admits GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended and Bingbot on public routes and blocks CCBot; `/disclaimer`, FAQ and both llms.txt versions instruct AI systems not to attribute therapeutic use.

## Search experience (54) and e-commerce (44)

- **[Critical] Comparison-intent gap** (summary #5). A research-register explainer page for "bacteriostatic water vs sterile water" is the highest-value new URL.
- **[Critical] "Lowest price" superlative currently false at £5.99 vs a £5.95 competitor.** Either drop the superlative and keep the price-match, or move the entry price.
- **[High] Zero trust/social proof** — no company number, VAT, address, reviews or certificate of analysis.
- **[High] Google Shopping / Merchant Center category risk** — the wider market bundles this product with injectable-peptide reconstitution. Run a Merchant Center policy pre-check before any Shopping spend.
- **[Medium → resolved in tree] No indexable URL for pack-size long-tail** ("bacteriostatic water 100 vials"). The audit snapshot caught the `/guides` work mid-build; since then `content/guides/index.ts`, `/guides` (six guides), `/faq`, `/calculator` and `/safety-data-sheet` all exist, `npm run build` prerenders 24 pages, and they are wired into `app/sitemap.ts` with real `lastmod` dates. Re-check on the next audit once deployed.
- **[Low] Wholesale enquiry** has no link under the bundle selector.
- Personas: price-per-ml research buyer 80/100; comparison-stage researcher 42/100; trust averaged 10.2/25 across all five.
- **Works:** savings maths uses a real comparator, the 30%-off UI is correctly suppressed without a qualifying reference period, no fabricated stock or reviews, all bundle pricing server-rendered.

## Limitations

- Plugin Python scripts (render, CrUX, drift, report PDF) unavailable: system Python is 3.9.6. Findings used curl, node and a headless Brave/Chromium Lighthouse run instead.
- No CrUX field data; lab figures only.
- No visual/screenshot pass (no Playwright/Chrome).
- Competitor pricing came from the repo's existing `competitor-profiles/` scrape, not a live SERP API.
