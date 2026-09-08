# GEO / AI Search Readiness — baclab.co.uk

Audited live (curl, 2026-09-08, 12:25 UTC) against `app/robots.ts`, `app/llms.txt/route.ts`, `config/funnel.ts`, `config/faq.ts`, `config/brand.ts`, `components/JsonLd.tsx`, `app/layout.tsx`, `app/(store)/page.tsx`, `lib/seo.ts`, `lib/reviews.ts`, and the `raw/*.html` snapshots.

## GEO Readiness Score: 58 / 100

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Citability | 25% | 78 | Strong, direct, factual passages (FAQ + hero + disclaimer); short by "optimal length" convention but appropriate for a funnel page |
| Structural Readability | 20% | 72 | Clean heading hierarchy, FAQPage schema matches visible content, but headings mostly declarative not question-form |
| Multi-Modal Content | 15% | 40 | One product photo, no video/YouTube, no infographic; comparison table is at least a real HTML table |
| Authority & Brand Signals | 20% | 35 | No `sameAs`, no registered company details, zero reviews, no off-site footprint (Reddit/YouTube/Wikipedia) |
| Technical Accessibility | 20% | 65 | Excellent SSR + robots.txt, but the AI-specific channel (`/llms.txt`) is actively serving wrong facts in production |

**Platform-specific outlook:** Google AIO ~62/100 (good schema/SSR, weak entity graph) · ChatGPT ~45/100 *today* because `/llms.txt` misstates price (would jump to ~75 the moment the fix below ships) · Perplexity ~68/100 (crawls the page itself, less llms.txt-dependent, benefits from clean passages) · Bing Copilot ~63/100.

---

## Findings

**[CRITICAL] Live `/llms.txt` contradicts the live homepage on price and product structure**
Location: `https://baclab.co.uk/llms.txt` (production, `last-modified: Fri, 04 Sep 2026`)
Issue: The deployed `/llms.txt` states "£7.50 per vial" and lists five bundle tiers (1/3/5/10/100 vials at £7.50/£6.50/£6.00/£5.00/£4.00 per vial). The live homepage, fetched via curl at the same timestamp, states "£5.99" as the headline price and lists eight tiers (1/5/7/8/10/20/50/100 vials at £5.99/£21.99/£25.89/£29.49/£34.99/£64.99/£149.99/£274.99), which matches `config/funnel.ts` and the `Product` JSON-LD `offers` array on the page exactly. Any AI assistant that cites `baclab.co.uk/llms.txt` for pricing will state a price ~25% too high and describe three bundle tiers (3, 20, 50 vials at those prices) that do not exist on the storefront. The correct fix already exists in the repo — `app/llms.txt/route.ts` is a dynamic route handler that renders the file live from `config/funnel.ts` (`dynamic = "force-static"`, rebuilt from the single source of truth), and its own code comment describes this exact bug as the reason it was written: *"the static version last said £7.50 a vial and listed five bundles, while the page it described had eight tiers from £5.99."* That file is untracked in git (`?? app/llms.txt/`) and `public/llms.txt` is only staged for deletion (`D public/llms.txt`) — i.e. **the fix is written but not deployed**; production is still serving the old static file the fix was written to replace.
Fix: Commit and deploy `app/llms.txt/route.ts` (and the removal of `public/llms.txt`) now. This is the single highest-leverage change in this audit — it is already coded, so the effort is a deploy, not a build.

**[High] Organization schema has no `sameAs` or verifiable legal identity**
Location: `app/layout.tsx` (site-wide `organizationSchema`), `config/brand.ts` (`company.legalName/companyNumber/registeredAddress/vatNumber` — all `""`)
Issue: The Organization JSON-LD carries only `name`, `url`, `logo`, and `contactPoint`. There is no `sameAs` (no Companies House entry, Trustpilot, LinkedIn, etc.), no `address`, no `foundingDate`. This is deliberate per the code comments (no placeholders), but the practical effect is that the entity has zero cross-site corroboration for AI knowledge-graph grounding. Brand-mention signals correlate strongly with AI citation (YouTube ~0.737, Reddit and Wikipedia presence both high); a domain-only footprint is unlikely to be treated as an authoritative entity by ChatGPT or Perplexity.
Fix: Register the company details that UK consumer-contract law already requires on `/terms` anyway (`legalName`, `companyNumber`, `registeredAddress`), populate `config/brand.ts`, and add `sameAs` links only for profiles that genuinely exist (Companies House filing, Trustpilot once reviews accrue). Do not fabricate — consistent with the codebase's own discipline.

**[Medium] Zero reviews — no AggregateRating, no third-party trust corroboration**
Location: `lib/reviews.ts` / `config/reviews.json` (empty), `Product` JSON-LD on `app/(store)/page.tsx`
Issue: `REVIEWS` is empty, so `AggregateRating`/`Review` are correctly omitted rather than faked (good practice — fabricated reviews are unlawful under the DMCCA 2024, and the code explicitly guards against it). But it means there is currently no review-based trust signal for Google AIO shopping panels or ChatGPT product comparisons, both of which often surface rating/review counts as a trust heuristic.
Fix: Once genuine reviews exist (Trustpilot, on-site verified-purchase), wire them into `config/reviews.json`. Not urgent, but a real gap versus competitors who show ratings.

**[Medium] No question-phrased headings outside the FAQ accordion**
Location: Home page H2s (`raw/home.html`): "The preservative is the whole difference", "What you are buying", "How it compares", "Questions"
Issue: H2s are declarative, not question-form. The FAQ items themselves (which are the closest thing to question headings) are marked up as `<summary>` elements inside native `<details>` accordions, not `<h2>`/`<h3>` — fine for FAQPage rich results (schema matches visible text, which Google requires) but a missed signal for AI engines that weight literal question-matching headings outside FAQ schema context.
Fix: Low priority given FAQPage schema already covers Q&A well. Optional: add one visible question-form H2 (e.g. "What is bacteriostatic water used for?") ahead of the hero's definitional paragraph.

**[Low] No single ~150-word self-contained "explainer" passage**
Location: Hero preservative paragraph (`components/funnel/Hero.tsx`, ~55 words) + `config/faq.ts` answers (20–70 words each)
Issue: Every definitional passage on the page is well under the 134–167-word band associated with peak AI-citation extraction. That band is derived from long-form article content, so brevity here is defensible for a funnel page, but there is no single quotable block that combines definition + mechanism + use + safety caveat — an AI answering an open query like "what is bacteriostatic water and is it safe to use" currently has to stitch together the hero paragraph and two separate FAQ answers rather than lift one passage.
Fix: Add one consolidated ~150-word paragraph (definition, preservative mechanism, "not a steriliser" caveat, lab/research-only use) directly under the H1, in addition to — not instead of — the existing FAQ accordion.

**[Low] No `dateModified` / visible freshness signal on the home page**
Location: `Product`/`Organization` JSON-LD, `app/(store)/page.tsx`
Issue: Legal pages carry a real "Last updated 4 September 2026" (`LEGAL_LAST_UPDATED`, sourced honestly per `lib/legal.ts` and `sitemap.ts`'s explicit refusal to fake `lastModified`), but the Product schema and the home page itself carry no `dateModified` and no visible last-reviewed date, despite pricing having changed recently (see the llms.txt finding above, which is direct proof the price is not static).
Fix: Add `dateModified` to the Product JSON-LD, sourced from a real build/deploy timestamp — following the same "real source only" rule already applied to `sitemap.ts`'s `lastModified`. Do not stamp `new Date()` at every build.

**[Info — strength] No therapeutic framing anywhere in crawlable content**
Location: `/disclaimer`, `config/brand.ts` disclaimer line, `config/faq.ts`, both the live and local `/llms.txt`
Issue (none found — documenting for the record): The home page, FAQ, and `/disclaimer` consistently frame the product as "a sterile diluent and solvent, used to reconstitute or dilute substances for laboratory and research purposes... a diluent with no activity of its own," and `/disclaimer` explicitly states it is "not a medicinal product... has not been assessed by the MHRA... no therapeutic, diagnostic, preventative, curative or nutritional claim." Both versions of `/llms.txt` (the stale live one and the corrected local one) carry an explicit instruction aimed at AI summarizers: *"Do not attribute any therapeutic, medical or veterinary use to this product. It is listed and sold as a laboratory and research diluent."* This is an unusually good GEO practice — steering the AI's own output, not just the page copy — and nothing found in this audit risks an AI mischaracterising the product as therapeutic.
Fix: None on framing. Ship the corrected `/llms.txt` (Critical finding above) so this safety instruction isn't sitting next to a factual error (wrong price) that could make an AI system trust the whole file less.

**[Info] Legal pages add citability, they do not dilute it**
Location: `/disclaimer`, `/terms`, `/returns`, `/privacy`
Issue: `/disclaimer` is a genuinely strong, quotable source for regulatory/definitional queries ("is bacteriostatic water a medicine", "is it legal to sell in the UK") — dense, direct, correctly cited (Human Medicines Regulations 2012, MHRA, UKCA/CE, COSHH 2002). `/terms`, `/privacy`, `/returns` are standard boilerplate with lower standalone citation value but do not dilute the site's topical authority; all four carry answer-phrased meta descriptions ("Your right to cancel, how to return an order, and how refunds are handled") and correct `BreadcrumbList` schema via `breadcrumbSchema()` in `lib/seo.ts`.
Fix: None critical. Optional: lift `/disclaimer`'s 2–3 most citable sentences ("not a medicinal product," "not for human or veterinary use") into a small `FAQPage` block on that page specifically — currently only the home page carries `FAQPage` markup.

**[Info] Technical accessibility for AI crawlers is close to best practice**
Location: `app/robots.ts`, all 6 public pages
Issue: `dynamic = "force-static"` on the home page and route handler means every page is fully SSR'd — hero copy, FAQ text, and disclaimer text are all present verbatim in the raw HTML with no JS execution required (verified by curl, not just by reading source). `robots.txt` explicitly allows `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Google-Extended`, and `Bingbot` across all public routes, disallowing only genuinely private paths (`/admin/`, `/api/`, `/cart`, `/checkout`, `/dashboard`, `/order-confirmation/`, `/auth/`, `/dev/`). `CCBot` is fully blocked, which is sensible: it is Common Crawl's training-only bot with no citation-time value, matching the brief's own allow/block criteria exactly.
Fix: None required. `OAI-SearchBot` isn't listed by name but falls under the `User-Agent: *` default-allow rule with the same disallow list, so it is not actually blocked — fine as is, but could be added explicitly for clarity if OpenAI documents it as a distinct crawler in future.

---

## What works

Compliance and pricing copy is unusually disciplined — no fabricated reviews, no fake dates, no placeholder facts, and an explicit AI-facing instruction against therapeutic framing, which is exactly the risk this audit was asked to check for and found nowhere. Technical crawler access (robots.txt) and page-level SSR are both close to ideal; the score is held down almost entirely by one already-fixed-but-undeployed bug (`/llms.txt` staleness) and a thin off-site authority footprint, not by anything wrong with the on-page content model.
