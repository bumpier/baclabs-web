# Technical SEO — baclab.co.uk (audited 2026-09-08)

Method: live curl fetches of https://baclab.co.uk plus raw/*.html + raw/*.headers snapshots in this audit folder, cross-checked against source at /Users/liam/development/bacwater-website (read-only). Python plugin scripts unavailable; used curl/grep directly.

---

## [Critical] Production build is stale — /llms.txt serves wrong, out-of-date pricing to AI answer engines

**Location:** `https://baclab.co.uk/llms.txt` (live) vs. `app/llms.txt/route.ts` (repo, untracked/uncommitted per `git status`: `?? app/llms.txt/`) and `public/llms.txt` (repo, deleted per `git status`: `D public/llms.txt`).

**Issue (evidence):** The live `/llms.txt` response (fetched 2026-09-08) says:
```
Bacteriostatic Water, 10ml vial. £7.50 per vial.
...
- 1 vial — £7.50 (£7.50 per vial)
- 3 vials — £19.50 (£6.50 per vial)
- 5 vials — £30.00 (£6.00 per vial)
- 10 vials — £50.00 (£5.00 per vial)
- 100 vials — £400.00 (£4.00 per vial)
```
The live homepage and its Product JSON-LD (both `raw/home.html` and a fresh curl) say the single vial is **£5.99** across **8** bundle tiers (1/5/7/8/10/20/50/100, up to £274.99 for 100). The repo already contains a fix: `app/llms.txt/route.ts` renders this file dynamically from `config/funnel.ts` specifically so it can never disagree with the storefront — its own code comment says "the static version last said £7.50 a vial and listed five bundles ... Nothing here can now disagree with the storefront." That file is untracked in git (never committed/pushed), and `public/llms.txt` (the old static file it replaces) is staged as deleted but still live. **The fix exists in the working tree but was never deployed.** Any AI assistant or answer engine reading `/llms.txt` today quotes a price customers cannot get, and a bundle structure (3/5/10/100 vials) that doesn't exist on the site.

**Fix:** Commit and deploy `app/llms.txt/route.ts`, remove `public/llms.txt`, redeploy, then purge the Cloudflare cache for `/llms.txt` (it currently serves `cache-control: public, max-age=0` but Cloudflare may still hold an edge copy). Verify post-deploy with `curl -s https://baclab.co.uk/llms.txt | grep vial`.

---

## [High] `sitemap.xml` lastmod values look like leftover output from the old (pre-fix) build

**Location:** `https://baclab.co.uk/sitemap.xml` (live) vs. `app/sitemap.ts` (repo).

**Issue (evidence):** Live sitemap gives every one of the 6 URLs the identical `<lastmod>2026-09-07T13:51:25.707Z</lastmod>`. The committed `app/sitemap.ts` sets no `lastModified` field at all on any entry, and its own comment explains why: *"No `lastModified`: the old value was `new Date()`, which re-stamped every URL at each build. Google ignores lastmod once it sees it is not tied to real content changes, so a fake one is worse than none."* A single identical timestamp across every URL is exactly the signature of that old `new Date()`-at-build behaviour the comment describes — i.e. this is the same stale-deploy pattern as the `/llms.txt` finding above, not a config error in the current source. Since `app/sitemap.ts` is not in `git status`'s modified list, this looks like the live deployment simply predates a redeploy, corroborating that production is running an older build than the local repo.

**Fix:** Redeploy from current `main`/working tree (same action as the `/llms.txt` fix resolves this too) and re-fetch `/sitemap.xml` to confirm `<lastmod>` disappears. If it doesn't, check for a Next.js build-cache artifact being reused across deploys (`.next/cache` not cleared).

---

## [High] `cache-control: s-maxage=31536000` on all indexable HTML — unsafe if Cloudflare ever caches HTML, and undermines redeploy-driven price fixes

**Location:** All 6 indexable pages (`home.headers`, `returns.headers`, `contact.headers`, `terms.headers`, `disclaimer.headers` — `privacy.headers` is deliberately different, see "what works").

**Issue (evidence):** Every static page ships `cache-control: s-maxage=31536000` (1 year) with `x-nextjs-cache: HIT` / `x-nextjs-prerender: 1`, i.e. these are fully static exports with **no time-based revalidation** (`grep -rn revalidate app` finds no `export const revalidate` on the home page or legal pages — `revalidatePath` is only called from unrelated admin actions targeting `/admin/*`, `/products`, and `/privacy`, never `/`). Pricing lives in `config/funnel.ts` (code, not a DB), so a price change only takes effect on a fresh deploy. Right now `cf-cache-status: DYNAMIC` on every page shows Cloudflare is currently *not* caching this HTML at the edge, so the 1-year value is inert today — but that is a property of Cloudflare's current zone defaults, not of anything this app controls or asserts. If a "Cache Everything" page rule, an APO-style plugin, or a future Cloudflare Cache Rule for HTML is ever turned on, this header tells Cloudflare (and any other downstream cache, e.g. a corporate proxy) it may hold this page — bundle prices from £5.99 to £274.99 included — for up to a year, surviving a redeploy until an explicit purge. For a live UK distance-selling checkout funnel, serving a stale price that doesn't match what Stripe charges at checkout is a real trust and Consumer Rights Act 2015 exposure, not just an SEO staleness issue.

**Fix:** Lower `s-maxage` to something that bounds the actual worst case (e.g. `s-maxage=300, stale-while-revalidate=86400`) so any cache that *does* respect the header can't hold a stale price for more than a few minutes; and/or add an explicit Cloudflare Cache Rule that bypasses cache for `Content-Type: text/html` on this zone so behaviour doesn't depend on Cloudflare's implicit defaults never changing. Either way, make cache purge-on-deploy (`Cloudflare Purge Everything` or purge-by-URL for `/`, `/returns`, `/contact`, `/terms`, `/privacy`, `/disclaimer`) part of the deploy script referenced in `deploy/README.md`, since a price fix currently ships in the HTML but nothing guarantees an edge cache is invalidated.

---

## [Medium] `www.baclab.co.uk` returns 200 with no redirect to the apex

**Location:** `https://www.baclab.co.uk/` (live).

**Issue (evidence):** `curl -D - https://www.baclab.co.uk/` returns `HTTP/2 200` (not a redirect), serving byte-identical HTML to the apex, including a self-consolidating `<link rel="canonical" href="https://baclab.co.uk"/>` — confirmed correct: `app/layout.tsx` sets `alternates: { canonical: "/" }` against a fixed `metadataBase` from `canonicalOrigin()`, so the canonical is apex-only regardless of which host served the request. This is intentional (`deploy/README.md` provisions nginx for `baclab.co.uk` **and** `www`, and `lib/site-url.ts` documents a "multi-domain deployment"), and the canonical tag means Google should consolidate signals to the apex rather than treat this as duplicate content. It's still not best practice: two fully-crawlable 200 URLs for every page (12 total, not 6) waste crawl budget, dilute any link equity earned by a `www` link/share before canonicalization is respected, and `http://` correctly 301s to the apex (`http://baclab.co.uk/` → `Location: https://baclab.co.uk/`) while `www` gets no equivalent host-consolidation redirect — inconsistent handling of the two most common URL variants.

**Fix:** Add a host-based 301 from `www.baclab.co.uk/*` → `https://baclab.co.uk/*` at the nginx/Cloudflare layer (the canonical tag is a safety net, not a substitute for it), unless `www` is deliberately reserved as one of the "many domains at once" referral/recruit targets described in `lib/site-url.ts` — if so, document that exception explicitly so it isn't "fixed" by accident later.

---

## [Medium] `/admin/login` is publicly reachable, inherits the homepage's indexable metadata, and has no page-level noindex

**Location:** `https://baclab.co.uk/admin` → 307 → `https://baclab.co.uk/admin/login` (200).

**Issue (evidence):** `robots.txt` disallows `/admin/` for every named crawler and `*` (trailing slash correctly prefix-matches `/admin/login` too), so compliant crawlers won't fetch it. But the page itself ships `<title>Buy Bacteriostatic Water UK — 10ml vial, £5.99 | BacLab</title>` (the root layout's default title, unoverridden) and `<meta name="robots" content="index, follow"/>` — the same as every real indexable page. There is no page-level `noindex` and no `X-Robots-Tag` header (`curl -D - ... | grep -i x-robots` returns nothing). This is single-layer protection: if robots.txt is ever loosened, mis-scoped, or ignored by a non-compliant crawler, or if the URL is discovered via a referrer/backlink, there is nothing on the page itself stopping indexing of a staff login form under the store's own branded title.

**Fix:** Give `app/admin/login` (or its layout) explicit `metadata.robots = { index: false, follow: false }`, and add `X-Robots-Tag: noindex, nofollow` as defense-in-depth alongside the existing robots.txt disallow.

---

## [Medium] Contact email is only reachable via Cloudflare's email-obfuscation redirect, not as plain text or a working `mailto:` for non-JS agents

**Location:** `raw/contact.html` (2 occurrences), and 2–6 occurrences of the same pattern on every other page (`returns.html`: 4, `terms.html`: 3, `privacy.html`: 6, `disclaimer.html`: 2, `home.html`: 3).

**Issue (evidence):** Every visible email reference on the site is rendered as `href="/cdn-cgi/l/email-protection#<hex>"` with `data-cfemail="264e434a4a49664447454a474408454908534d"` (Cloudflare's "Email Address Obfuscation" feature), which only resolves to a real `mailto:` link client-side via Cloudflare's injected `email-decode.min.js`. Any consumer, bot, or AI crawler that reads raw HTML/text without executing that specific script — including the audit's own text-extraction, and any answer engine that fetches HTML without a full browser — sees an opaque `/cdn-cgi/l/email-protection#...` link and no legible address in the page body. `grep -o 'href="mailto:[^"]*"'` across all 6 pages returns **zero** plain `mailto:` links. The one place the address is genuinely machine-readable is the Organization JSON-LD (`"email":"hello@baclab.co.uk"` in `contactPoint`) — good, but it's the only source of truth, and it's absent from the `/contact` page's own visible copy.

**Fix:** Either turn off Cloudflare's Email Address Obfuscation for this zone (CSP already restricts inline scripts to `'self'` plus a small analytics allow-list, so this obfuscation is providing marginal anti-scraping value against a determined bot anyway) or keep it but also expose the address in `Person`/`ContactPoint`/`WebPage` structured data on `/contact` specifically (not just the sitewide Organization block), so AI/LLM crawlers and accessibility tools have at least one non-JS-dependent path to the real address.

---

## [Medium] Product JSON-LD has no `image`; no `BreadcrumbList` is emitted on any of the 5 interior pages despite a ready-made helper

**Location:** Product schema in `raw/home.html`; `lib/seo.ts` `breadcrumbSchema()`.

**Issue (evidence):** The `Product` JSON-LD block (`@type":"Product"`, sku `baclab-10ml`) has `name`, `description`, `sku`, `brand`, and 8 `Offer`s, but no `image` field — Google's Product rich-result guidance treats `image` as expected/recommended, and its absence limits merchant-listing eligibility. Separately, `lib/seo.ts` exports `breadcrumbSchema(name, path)` with a comment describing exactly how it should be used ("Every interior page is one level below the home page, so the trail is always Home → this page"), but `grep -o '"@type":"BreadcrumbList"'` against `returns.html`, `contact.html`, `terms.html`, `privacy.html`, and `disclaimer.html` returns nothing on all 5 — the helper is dead code, never wired into any page.

**Fix:** Add `"image": "https://baclab.co.uk/bacteriostatic-water-10ml-research-vial-uk-astra-labs.webp"` (plus `width`/`height` or an `ImageObject`) to the Product schema; call `breadcrumbSchema()` from each of the 5 interior page components and pass its output through the existing `<JsonLd>` component.

---

## [Low] Hero LCP image has no responsive `srcset`/`sizes` (plain `<img>`, not `next/image`)

**Location:** `raw/home.html` hero image, `bacteriostatic-water-10ml-research-vial-uk-astra-labs.webp`.

**Issue (evidence):** `<img src="/bacteriostatic-water-10ml-research-vial-uk-astra-labs.webp" width="1122" height="1402" ... fetchPriority="high" decoding="async"/>` — `fetchPriority="high"` and explicit `width`/`height` (correctly preventing CLS) are present and good, but `grep -c '_next/image' raw/home.html` returns `0`: this bypasses Next's Image component, so there's no `srcset`/`sizes`, and every device downloads the same single 1122×1402 file (currently 41,852 bytes per a live fetch — small enough that this is a Low, not a Medium, but it will regress silently if the source photo is ever swapped for something larger, since there's no build-time optimisation pipeline catching it). The file is also served with `cache-control: public, max-age=14400` (4 hours) rather than long-lived immutable caching, because the filename carries no content hash — a wasted revalidation on effectively every repeat visit for an asset that rarely changes.

**Fix:** Serve the hero image through `next/image` (or add a manual `srcset` for at least a mobile-width variant) so a phone doesn't fetch a 1122px-wide image, and either content-hash the filename or extend `max-age` with an immutable directive if the file is expected to be stable.

---

## [Low] No `apple-touch-icon`, no web manifest, no `favicon.ico` fallback

**Location:** All pages; confirmed via live curl.

**Issue (evidence):** Only `<link rel="icon" href="/icon.svg?..." type="image/svg+xml" sizes="any"/>` is emitted. `curl -o /dev/null -w '%{http_code}'` against `/apple-icon.png`, `/manifest.json`, `/site.webmanifest`, and `/favicon.ico` all return `404`. SVG favicons are broadly supported, but iOS "Add to Home Screen" and older browsers/crawlers that specifically look for `apple-touch-icon` or a manifest get nothing, so a home-screen bookmark falls back to a screenshot rather than the brand mark.

**Fix:** Add `app/apple-icon.png` (Next.js file-convention icon) and a minimal `app/manifest.ts`/`manifest.webmanifest` with `name`, `short_name`, `icons`, and `theme_color` matching the `--brand` value already defined inline (`#0047FF`).

---

## [Info] `robots.txt` / crawler policy — correctly scoped, one deliberate exclusion worth confirming

**Location:** `https://baclab.co.uk/robots.txt` (live), matches `app/robots.ts` exactly.

**Issue (evidence):** Per-bot rules for GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, and Bingbot all `Allow: /` with the same `Disallow` list as the default `*` rule (`/admin/`, `/api/`, `/cart`, `/checkout`, `/dashboard`, `/order-confirmation/`, `/auth/`, `/dev/`) — correct coverage of every private route named in the brief, and it correctly matches live behaviour (`/checkout` is `200` but carries page-level `noindex, nofollow`; `/order-confirmation/<id>` 404s for an invalid id, so it was not possible to confirm its noindex tag directly — recommend a follow-up check against a real order id). `CCBot` is fully `Disallow: /` — a deliberate choice ("Block training-only crawlers that don't provide citation value" per the code comment) rather than an oversight; flagging only so it's a conscious decision, since it also blocks Common Crawl-derived datasets some smaller AI answer engines rely on instead of running their own crawler.

**Fix:** None required — confirm the `CCBot` block is still the intended policy periodically as AI-crawler landscape shifts.

---

## [Info] Old paths and legal-page redirects

**Location:** `next.config.js` `redirects()`, confirmed live.

**Issue (evidence):** `/products` and `/products/:slug` → `/` (308, permanent), `/refunds` → `/returns` (308, permanent), `/cart` → `/#buy`, `/auth/:path*` → `/`, `/dashboard` → `/`, `/shipping` → `/` all work as configured and match the brief's "already observed" notes. Trailing-slash normalisation (`/returns/` → `/returns`, 308) works site-wide. No redirect chains detected (all single-hop). `/products` and `/refunds` correctly use `308` not `301`, preserving method — appropriate for a Next.js permanent redirect.

**Fix:** None.

---

## [Info] 404 handling

**Location:** `https://baclab.co.uk/<random-nonexistent-path>`.

**Issue (evidence):** Returns a true `HTTP/2 404` (not a soft-404 200), with the standard Next.js not-found boilerplate. Correct status code means no explicit `noindex` meta is needed and none is required.

**Fix:** None.

---

## [Info] JS-rendering dependence — page is server-rendered, not CSR-dependent

**Location:** All 6 pages.

**Issue (evidence):** All 6 responses carry `x-nextjs-prerender: 1` and `x-nextjs-cache: HIT` (except `/privacy`, deliberately `force-dynamic`, see "what works" below) — genuinely static HTML, not a client-rendered shell. Stripping tags from `raw/home.html` (97,583 bytes total) yields ~6,454 bytes of visible text containing the full hero copy, spec table, all 8 bundle prices, comparison table, and FAQ answers — a bot fetching raw HTML with `--mode never` (no Playwright) would see the same content a browser renders. The remaining ~93KB is React/Next hydration payload (an inline duplicate serialization of the same JSON-LD/props for client hydration, standard App Router behaviour, not a defect) plus preload links and chunk script tags. No `<noscript>` fallback exists, but none is needed since the primary content isn't JS-gated.

**Fix:** None — this is a strength, not a gap; see "what works."

---

## [Info] Security headers

**Location:** All pages, via `next.config.js` `securityHeaders`.

**Issue (evidence):** Every response (including private routes) carries `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and a real `Content-Security-Policy` scoped to `'self'` plus a small, named allow-list (Meta Pixel + GA4 hosts only) — no wildcard host allowances. One weakness: `script-src 'self' 'unsafe-inline'` — `'unsafe-inline'` is required for Next.js's inline hydration/JSON-LD `<script>` tags as currently implemented (no nonce/hash strategy), which meaningfully weakens the CSP's XSS mitigation value versus a nonce-based policy, though this is a defense-in-depth/security-hardening note rather than an SEO defect.

**Fix (optional hardening, not SEO-blocking):** Consider a per-request nonce for inline scripts to drop `'unsafe-inline'` from `script-src` if/when the team revisits CSP; not required for this audit's scope.

---

## What works

Canonicals are correct and self-consistent on every one of the 6 indexable pages (apex host, no trailing slash, no query string), robots.txt/sitemap.xml scope exactly matches the 6 public + all listed private routes with zero drift, and the entire site is genuinely server-rendered (not CSR-dependent) so bots see full content without executing JS. The `/privacy` page's deliberately `force-dynamic` rendering (reading a live Meta-Pixel toggle so it can never claim "no tracking" while one is running) and its correspondingly different `cache-control: private, no-store` header is a correct, well-reasoned exception, not an inconsistency.

## Score: 64/100

Driven down primarily by two deploy-drift Critical/High findings (stale `/llms.txt` misquoting price to AI answer engines by up to 25%, and sitemap `lastmod` artifacts from an older build) that are already fixed in the working tree but not shipped, plus a caching header that's currently safe only by accident of Cloudflare's default settings, not by explicit configuration.
