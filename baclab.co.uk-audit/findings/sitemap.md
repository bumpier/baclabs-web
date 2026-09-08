# Sitemap audit — baclab.co.uk

Scope: live `https://baclab.co.uk/sitemap.xml` and `/robots.txt` (fetched 2026-09-08), compared against the uncommitted `app/sitemap.ts` that will replace it on next deploy. Cross-checked against `components/Footer.tsx` (`LEGAL_LINKS`), `app/robots.ts` (`privateRoutes`), `lib/site-url.ts`, and per-page `alternates.canonical` / raw HTML snapshots.

## Live sitemap.xml (current production)

```xml
<url><loc>https://baclab.co.uk</loc><lastmod>2026-09-07T13:51:25.707Z</lastmod><changefreq>weekly</changefreq><priority>1</priority></url>
<url><loc>https://baclab.co.uk/returns</loc>... priority>0.4
<url><loc>https://baclab.co.uk/contact</loc>... priority>0.4
<url><loc>https://baclab.co.uk/terms</loc>... priority>0.3
<url><loc>https://baclab.co.uk/privacy</loc>... priority>0.3
<url><loc>https://baclab.co.uk/disclaimer</loc>... priority>0.3
```
6 URLs, well-formed XML (`xmllint --noout` passes), 1,030 bytes — far under the 50,000-URL / 50MB per-file cap.

## Findings

**[Low] All six live URLs share one identical `lastmod`** / live `sitemap.xml`, all six `<url>` entries / Every entry has `lastmod = 2026-09-07T13:51:25.707Z`, which is the Next.js build timestamp, not a per-page content-change date. This is the exact anti-pattern the check rubric flags: it gives Google no real freshness signal and Google is known to start ignoring `lastmod` once it detects it's not tied to real edits. (Evidence: identical ISO timestamp across `/`, `/returns`, `/contact`, `/terms`, `/privacy`, `/disclaimer` in the curl'd body.) / No fix needed against current source — see next finding, the incoming code already removes this.

**[Info] New `app/sitemap.ts` correctly drops the fake `lastmod`** / `app/sitemap.ts:16-19` (code comment) and the returned objects (lines 30-37) / The new source omits `lastModified` entirely, with an explicit comment explaining the old `new Date()` value re-stamped every URL on every build and was worse than no signal. This is the right call per the rubric ("reflects last *significant* change, not boilerplate") — none of the 6 pages (home + 5 legal boilerplate) has a real per-page change-tracking source yet. / No action required. If a real source becomes available later (git commit date of the MDX/page file, or a CMS `updatedAt`), wire it in then — do not resurrect a build-timestamp value.

**[Info] `priority` / `changefreq` still emitted, both ignored by Google** / live `sitemap.xml` (all 6 entries) and `app/sitemap.ts:30,34-36` (`changeFrequency`, `priority` fields carried over unchanged) / Google has publicly stated both tags are ignored; Bing gives `priority` minimal weight at best. The new source keeps the same priority tiers as the live file (`1` / `0.4` for contact+returns / `0.3` for the rest), so this is not a regression, just carried-forward legacient. / Optional cleanup: can be removed with no SEO impact. If kept (e.g., for Bing or internal documentation value), keep the tiering rationale in the code comment (already present at line 35) so it doesn't rot when new page types are added — see the priority recommendations below for the pages a peer session is about to add.

**[Pass] Host / canonical / indexability all match, live and new source** / live `sitemap.xml` vs `raw/*.html` `<link rel="canonical">` and `meta name="robots"` vs `app/(store)/*/page.tsx` `alternates.canonical` vs `app/sitemap.ts` / All 6 sitemap URLs use the bare apex `https://baclab.co.uk` (no `www`, no trailing slash), matching `NEXT_PUBLIC_SITE_URL` in `.env.example`, `metadataBase` in `app/layout.tsx:33`, and every page's live `<link rel="canonical">` tag exactly (checked home, contact, returns, terms, privacy, disclaimer — all self-referencing, all `robots: index, follow`). The new `app/sitemap.ts` derives the same 5 legal paths from `LEGAL_LINKS` (`components/Footer.tsx:10-16`) plus home, so it will emit an identical URL set to what's live today. None of the 6 overlap `privateRoutes` in `app/robots.ts` (`/admin/`, `/api/`, `/cart`, `/checkout`, `/dashboard`, `/order-confirmation/`, `/auth/`, `/dev/`). No missing indexable pages, no extra 404/redirect/noindex entries. / No action.

**[Pass] robots.txt correctly references the sitemap and matches the private-route list** / live `robots.txt` vs `app/robots.ts` / `Sitemap: https://baclab.co.uk/sitemap.xml` is present exactly once; the `Disallow` list for `*`, `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Google-Extended`, `Bingbot` matches `privateRoutes` in `app/robots.ts` verbatim, and none of those paths appear in the sitemap. / No action.

**[Info] `TOP_LEVEL` is currently empty — deriving the legal set from `LEGAL_LINKS` is a good coupling but has a blind spot** / `app/sitemap.ts:22-25,39` / Coupling legal pages to the footer's `LEGAL_LINKS` array means the sitemap can't drift from what's actually linked — good. But `TOP_LEVEL` is a hand-maintained static array; nothing enforces that a new top-level page (e.g., a route added under `app/(store)/`) gets appended to it, and nothing enforces the reverse — that every `TOP_LEVEL` entry actually has a live route with a self-canonical tag. This is purely a process risk, not a current defect (today `TOP_LEVEL` is `[]` and there's nothing to miss). / When the peer session adds `/guides/*`, `/faq`, `/calculator`, `/safety-data-sheet`, verify each new path has (a) a matching `alternates.canonical` in its page metadata, (b) `robots: index, follow` (or nothing, which defaults to indexable), and (c) is absent from `privateRoutes` — the same three-way match already holding for the 6 live pages.

## Guidance for the peer session adding `/guides/*`, `/faq`, `/calculator`, `/safety-data-sheet`

**Wiring into `TOP_LEVEL`:** the array's existing contract (per the code comment at `app/sitemap.ts:22-24`) is path-only entries, origin-prefixed at line 39 — e.g. `{ url: "/faq", changeFrequency: "weekly", priority: 0.5 }`. `/guides/*` is a glob, not a literal path — if it becomes a collection of individual guide pages, each guide slug needs its own array entry (or the array needs to be built by mapping over a guides content source, e.g. `fs.readdirSync` on an MDX directory or a CMS query), not a single wildcard string. A literal `"/guides/*"` string in `TOP_LEVEL` would get emitted as `https://baclab.co.uk/guides/*` — an invalid, non-existent URL — so confirm the implementation enumerates real slugs before merge.

**Recommended priority tiers** (informational only, since Google ignores the field, but useful for internal consistency and for crawlers/tools that still weight it):
- `/calculator` — 0.6–0.7. It's an interactive, conversion-adjacent utility (closer to product-consideration intent than the legal pages), should sit above the 0.4 given to `/contact` and `/returns` but below home's `1`.
- `/faq` and `/safety-data-sheet` — 0.5. Both are trust/compliance-relevant informational pages a research/lab buyer is likely to seek out before purchase; put them above the 0.3–0.4 legal boilerplate tier, in line with the existing "commercial trust pages get a higher priority than boilerplate" rationale already coded at `app/sitemap.ts:35`.
- `/guides/*` index (if a `/guides` landing page exists) — 0.5; individual guide articles — 0.3–0.4 each, depending on depth/uniqueness. Do not give every guide the same 0.5+ as `/calculator` — that flattens the signal for crawlers that do respect priority and stops it communicating anything.
- Consider `lastModified` for guides specifically (unlike the legal pages, guide content genuinely changes) sourced from real data — file mtime, git log date, or CMS `updatedAt` — not `new Date()` at build time. This is the one page type here where a real `lastmod` is actually available and worth adding, unlike the legal pages this file currently (correctly) leaves lastmod-less.

**Sitemap index: not warranted yet.** Even after adding all four new top-level types, total URL count will stay in the tens (well under the 50,000-URL / 50MB single-file cap validated above — the live file is 1KB for 6 URLs). A single `app/sitemap.ts` continues to be the right shape. Revisit a sitemap index only if `/guides/*` grows into a large content library (hundreds of articles) where you'd want to split it into its own `guides-sitemap.xml` for independent Google Search Console monitoring/re-crawl cadence — not for size-limit reasons at the volumes implied here.

**Location-page quality gates:** not applicable — none of `/guides/*`, `/faq`, `/calculator`, `/safety-data-sheet` are programmatic location pages, so the 30/50-page doorway-page thresholds in this skill's quality gates don't trigger. If `/guides/*` later becomes a programmatically generated set (e.g., one guide per use-case × audience combination) rather than hand-authored content, re-apply the 30+/50+ thresholds at that point.

## Score: 94/100

**What works:** The live sitemap is small, valid XML, fully within size limits, and every URL is self-canonical, 200, indexable, and absent from `robots.txt` disallow rules — a completely clean host/canonical/indexability match across live HTML, page metadata, and both sitemap sources. The incoming `app/sitemap.ts` is a genuine improvement: it eliminates the fake, identical build-timestamp `lastmod` and structurally couples the legal-page set to `LEGAL_LINKS` so it can't silently drift from the footer.
