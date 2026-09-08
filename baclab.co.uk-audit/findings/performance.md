# Performance / Core Web Vitals — baclab.co.uk (mobile-first)

## Methodology (read this first)

Lighthouse **actually ran** — this is not static analysis only. Details:

- Lighthouse **13.4.1** (Node 26.8.1), invoked via `npx lighthouse https://baclab.co.uk --preset=perf --form-factor=mobile --output=json --chrome-flags="--headless=new --no-sandbox"`.
- Browser: **Brave Browser** (Chromium-based, `CHROME_PATH` pointed at `/Applications/Brave Browser.app`) — no Google Chrome/Chromium binary was installed in this environment, so Brave's Chromium engine was used as the headless driver. This is functionally equivalent to Chrome for Lighthouse's CDP-based tracing.
- Mode: **mobile**, default Lighthouse mobile throttling applied (simulated ~4x CPU slowdown + simulated slow-4G-equivalent network via the "simulate" throttling method) — a single lab run, not a real device, not field data.
- Full trace saved: `/Users/liam/development/bacwater-website/baclab.co.uk-audit/raw/lighthouse-mobile.json` (also `raw/lighthouse-run.log`).
- **CrUX field data was not retrieved.** The CrUX History API requires a Google API key; none is configured in this environment, and per the task's stop instruction this call was not executed. Everything below is **lab-only, single-run, mobile-simulated data** — it indicates real risk but is not a substitute for real-user 75th-percentile field data, which is what Google actually uses for ranking/CWV assessment. Treat the LCP figure as directional, not exact.

## Measured Core Web Vitals (Lighthouse 13.4.1, mobile, lab)

| Metric | Measured | Threshold (Good) | Status |
|---|---|---|---|
| **LCP** | **3.08s** (3080ms) | ≤2.5s | **Needs Improvement** (fails "Good") |
| **CLS** | 0.0001 | ≤0.1 | Good (effectively zero) |
| **TBT** (lab proxy for INP) | 38ms | n/a (proxy) | Good — implies low risk of INP failure |
| **INP** | Not measurable | ≤200ms | Lighthouse is a lab tool; INP requires real user interaction. No field data available (see above). |
| FCP | 2.4s | — | supporting metric |
| Speed Index | 2.7s | — | supporting metric |
| TTFB | 114ms (LCP breakdown) / 60ms (server-response-time audit) | ≤200ms (part of "good" LCP budget) | Good |
| Lighthouse Performance score | **91/100** | — | lab score (see category score below for why the category score differs) |

**Overall Performance category score: 78/100** (see rationale under "what works" and findings — the underlying engineering is strong, but the measured LCP already fails the "Good" threshold in a single controlled lab run, which is a real risk signal for the 75th-percentile field assessment Google actually uses, and there is no field data here to disprove that risk).

---

## Findings

### [High] LCP exceeds the "Good" threshold — and it isn't the hero image that's slow, it's the H1 text
- **Location:** `/` (homepage). LCP element identified by Lighthouse: `h1#hero-heading` ("Bacteriostatic water, sealed at ten millilitres."), selector `div.shell-wide > div.grid > div.lg:col-span-7 > h1#hero-heading`.
- **Issue (evidence):** `lcp-breakdown-insight` in the trace attributes LCP=3080ms as **TTFB 114ms + Element Render Delay 2,966ms (96% of total LCP)**. TTFB is excellent, so this is not a server/network problem — the byte arrives fast but the largest content isn't painted until ~3s in. FCP is already 2.4s, meaning the delay originates before *any* first paint, not in post-FCP work. Note: the hero product image is NOT the LCP element on mobile despite occupying a larger area (322×402 CSS px vs the H1's 372×139) — worth re-checking after any fix, since which element "wins" LCP can flip.
- **Fix:** Reduce time-to-first-paint. Prime suspects, in order of likely impact: (1) the render-blocking stylesheet below — inline critical above-the-fold CSS for the hero section so text can paint before the full 14KB stylesheet parses; (2) verify the `(store)/page-ccd7837759ea2b89.js` chunk and its dependencies (`619-…js`, `148-…js`) aren't required to hydrate before the hero text is visible — Next.js server-renders the H1 in the initial HTML, so it should be paintable pre-hydration; if it's visually blocked until hydration, that points to a CSS `opacity:0` state gated on a JS class toggle rather than the CSS-animation classes themselves (`animate-rise`/`stagger-*`, which were checked and only add ≤300ms — see Low-severity note below, ruled out as primary cause). (3) Re-test on a real mid-tier Android device / WebPageTest, since Lighthouse's default mobile CPU/network simulation can overstate render delay versus real 4G/5G UK traffic.

### [Medium] Render-blocking stylesheet delays first paint
- **Location:** `<head>`, `<link rel="stylesheet" href="/_next/static/css/18468d019ceb9f2a.css">` — **14,118 bytes**, loaded synchronously, no critical-CSS split.
- **Issue (evidence):** Flagged directly by Lighthouse's `render-blocking-insight` (score 0.5) as the sole render-blocking resource. It gates first paint until fully fetched + parsed, which lines up with FCP landing at 2.4s and cascading into the LCP delay above.
- **Fix:** Inline critical above-the-fold CSS (nav + hero section) directly in `<head>`, defer the remainder (`media="print" onload="this.media='all'"` pattern or a critical-CSS build step). At minimum, confirm Tailwind's output isn't shipping unrelated below-the-fold section styles (compare table, FAQ, footer) in this same blocking file — `unused-css-rules` currently scores 1 (no unused CSS detected in the executed trace) so this isn't a "purge more classes" problem, it's a "split what's already used" problem.

### [Medium] Hero image is ~4x oversized for its rendered size (31KB avoidable)
- **Location:** hero image, `<img src="/bacteriostatic-water-10ml-research-vial-uk-astra-labs.webp" width="1122" height="1402" fetchpriority="high" decoding="async" style="aspect-ratio:1122/1402" class="w-full rounded-panel object-cover">`, also preloaded via `<link rel="preload" as="image" fetchPriority="high">`.
- **Issue (evidence):** `image-delivery-insight` flags this exact file: delivered at **41,852 bytes**, intrinsic 1122×1402, but CSS renders it at only **564×704** (i.e. 2x DPR is already generous). Lighthouse estimates **31,296 bytes (75%) as wasted** — "This image file is larger than it needs to be for its displayed dimensions. Use responsive images to reduce the image download size." Loading *strategy* is correct here (fetchpriority high, preloaded, explicit width/height + aspect-ratio for CLS protection, async decoding) — this is purely an encoding/sizing problem, not a discovery-priority problem.
- **Fix:** Serve a responsive `srcset`/`sizes` (Next/Image `sizes` prop) with a ~564×704 (1x) and ~1128×1408 (2x) variant instead of one fixed 1122×1402 asset for all viewports. Expected savings ~30KB on this request. Since this image isn't the current LCP element it won't move the LCP number directly, but it reduces total mobile payload and removes a candidate risk if LCP element selection changes after the H1 fix above.

### [Low] Duplicate JSON-LD payload contributes to the 97KB HTML size
- **Location:** homepage `<head>`/`<body>`; three JSON-LD blocks — Organization (260B), Product (1,669B), FAQPage (3,182B) = 5,111B — are present as literal `<script type="application/ld+json">` tags **and again** serialized as escaped strings inside the Next.js RSC "flight" payload (`self.__next_f.push(...)` blocks), an additional ~1,919B + 3,416B = 5,335B.
- **Issue (evidence):** `home.html` is 97,789 bytes; of that, **44,951 bytes (46%) is inline `self.__next_f.push()` script content** — the Next.js App Router RSC streaming payload that serializes the entire server component tree (hero, product, preservative, compare-table, FAQ, final-CTA sections) for client hydration. This architecture is normal/expected for App Router and mostly not avoidable, but ~5.3KB of it is a straight duplicate of structured-data JSON that's already present verbatim elsewhere in the same document.
- **Fix:** Not a quick win, but worth a follow-up: investigate whether `components/JsonLd.tsx` can render its `<script>` tags in a way Next excludes from the RSC flight serialization (e.g. via `generateMetadata`/route-segment metadata injection or a purely server-only script tag) rather than as a hydratable client-visible node, removing the duplicate ~5KB. Do not touch the rest of the flight payload — that's core RSC architecture, not a bug.

### [Info] No CLS risk found in this crawl, but Sticky Buy Bar not re-verified
- CLS measured at 0.0001 in the lab run (effectively zero). The hero image reserves space via explicit `width`/`height` + inline `aspect-ratio` — correct pattern. No undimensioned images or late-injected blocks were found scanning the static `home.html`.
- `components/funnel/StickyBuyBar.tsx` is listed as modified in git status but was not re-inspected in this pass (told to stop investigating) — sticky/fixed-position elements don't register CLS by definition, but if the component's *show/hide* transition animates `height`/`top`/`margin` instead of `transform`, it could contribute to CLS on real devices in a way a single automated Lighthouse pass over a fresh page load won't catch (CLS from sticky bars is typically scroll/interaction-triggered). Recommend a manual scroll-and-observe check as a fast follow-up.

### [Info] Third-party scripts present in CSP but not found as blocking `<script src>` tags
- CSP `script-src` whitelists `connect.facebook.net`, `www.facebook.com`, `www.googletagmanager.com`, `www.google-analytics.com` (Meta Pixel + GA4), and the HTML includes `<link rel="preload" href="/api/pixel" as="script">` — a first-party-proxied endpoint. No direct `<script src="https://connect.facebook.net/...">` or `googletagmanager.com` tag was found in the 40 `<script>` tags present in the static HTML, suggesting these are injected client-side after hydration (or proxied) rather than render-blocking. The measured TBT (38ms) is consistent with minimal main-thread cost from whatever loaded during the trace window, but this pass did not fetch `/api/pixel`'s payload or time its client-side injection — flag for a dedicated third-party-script timing check if INP/TBT regressions appear later.

### [Info] Fonts, DOM size, unused code, main-thread work — all clean
- 2 self-hosted `woff2` fonts (`91601dd83defba07-s.p.woff2`, `e4af272ccee01ff0-s.p.woff2`) preloaded via Next/font; `font-display-insight` scores 1 with zero wasted ms — not a bottleneck.
- DOM size: 529 total elements, max depth 16 — well under the 1,500-element risk threshold.
- `unused-javascript` and `unused-css-rules` both score 1 (zero waste detected in the executed trace) — bundle is reasonably tight for what's used on this page.
- Main-thread work breakdown totals only 0.6s (script eval 187ms, style/layout 129ms, parse/compile 44ms) — low, consistent with the 38ms TBT.
- The CSS animation classes (`animate-rise`, `.stagger-1`…`.stagger-5`) were checked directly in the shipped stylesheet and ruled out as the LCP cause: `animation-duration:.24s`, and `.stagger-1{animation-delay:60ms}` through `.stagger-5{animation-delay:.38s}` are all **overridden to `animation-delay:0s !important`** by a later rule — max possible added delay is ~240ms, not the ~2,966ms element-render-delay actually measured.

---

## Score: 78/100

## What works
CLS (0.0001), TBT (38ms), TTFB (114ms/60ms), DOM size (529 elements), and unused-code ratios are all comfortably in the "good" range — the underlying build is lean and the hero image has correct loading hints (preload + fetchpriority=high + reserved dimensions), just wrong file sizing. The one real problem is LCP (3.08s, fails the 2.5s "Good" bar) driven almost entirely by pre-paint render delay rather than network or a heavy DOM — fixable by unblocking first paint (critical CSS) rather than by chasing image compression alone.
