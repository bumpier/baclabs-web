# baclab.co.uk — SEO Action Plan

Ordered by impact and effort. Evidence for every item is in `findings/`.

## Phase 1 — Critical fixes (this week)

1. **Deploy the current `main` plus working tree.** Clears: stale `/llms.txt` pricing, sitemap fake `lastmod`, missing Product `image`, missing BreadcrumbList on interior pages, renamed hero asset. Verify after deploy: `curl https://baclab.co.uk/llms.txt | grep 5.99`, `curl -s https://baclab.co.uk/sitemap.xml | grep -c lastmod` should be 0.
2. **Resolve the "UK's lowest price" claim.** Either reword to a price-match promise without the superlative on all four surfaces (hero trust bar, comparison note, FAQ, closing CTA) or reprice below £5.95. Source: `config/brand.ts` / `components/funnel/TrustBar.tsx`.
3. **Populate trader identity.** Fill `brand.company.*` (legal name, company number, registered address, VAT if registered). Confirm footer, `/contact`, `/terms` and Organization JSON-LD render it.
4. **Protect HTML from long-lived caching.** Add a Cloudflare cache rule bypassing HTML, or stop emitting `s-maxage=31536000` for `/`.

## Phase 2 — High-impact improvements (weeks 2–3)

5. **301 `www` → apex** at Cloudflare.
6. **`noindex` on `/admin/login`** via page metadata.
7. **Merchant fields on Product schema:** `hasMerchantReturnPolicy` and `shippingDetails` are now in the tree (sealed-goods caveat included; `deliveryTime` omitted until handling/transit days are configured). Still to add: `priceValidUntil`, per-Offer `sku`, and `deliveryTime` once those config values exist. Verify in Rich Results Test after deploy.
8. **LCP:** inline critical CSS or split the 14KB render-blocking stylesheet; serve the hero at 564×704 via `next/image` with `srcset`. Re-measure; target LCP < 2.5s mobile.
9. **Disable Cloudflare Email Address Obfuscation** (or render the address as text) so `mailto:` links and the plain address are crawlable.
10. **Per-page Open Graph** title/description on the five legal pages.
11. **Organization `sameAs`** once any external profiles exist (Companies House URL qualifies).

## Phase 3 — Content and authority (month 2)

12. **Publish a research-register comparison page**: "Bacteriostatic water vs sterile water" (~1,000 words, definitional opening paragraph, question-form H2s, no therapeutic framing). Link from the home page explainer section and FAQ.
13. **Ship the `/guides`, `/faq`, `/calculator`, `/safety-data-sheet` pages** now built and wired into `app/sitemap.ts` with real `lastmod` dates; after deploy, submit the sitemap in Search Console and audit the new pages (titles, canonicals, breadcrumbs, no therapeutic framing).
14. **About / sourcing page** with manufacturer, QC and certificate-of-analysis detail (only what can be evidenced).
15. **Wholesale enquiry link** under the bundle selector.
16. **Merchant Center policy pre-check** before any Shopping campaign.

## Phase 4 — Monitoring and iteration (ongoing)

17. Configure a PageSpeed/CrUX API key so the audit can use field data; re-run Lighthouse after Phase 2 item 8.
18. Search Console: submit the sitemap after deploy, check Product rich-result and Merchant listing reports.
19. Re-audit the home page after the comparison page and identity fields land; expect Content and SXO scores to move most.
20. Install Python 3.10+ (e.g. `brew install python@3.12`) so the claude-seo render, drift-baseline and PDF report scripts work next time.
