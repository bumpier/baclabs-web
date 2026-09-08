# Content Quality & On-Page SEO — baclab.co.uk

Source: raw/home.html, raw/returns.html, raw/contact.html, raw/terms.html, raw/privacy.html, raw/disclaimer.html (tag-stripped with node, structured data parsed directly). Fetched 2026-09-08.

---

## Findings

**[High] No trader identity (company name, number, or address) anywhere on the site**
Location: sitewide — /contact, /terms §1 "Our details", footer on every page, Organization JSON-LD on home.html.
Issue: The only identifying detail published anywhere is the trading name "BacLab" and the email `hello@baclab.co.uk` (confirmed via the Organization schema: `{"@type":"Organization","name":"BacLab","url":"https://baclab.co.uk","logo":"...","contactPoint":{"email":"hello@baclab.co.uk","contactType":"customer service","areaServed":"GB"}}`). /contact is a single email link with no phone, no registered/trading address, no company number. terms.html §1 "Our details" says only "Contact hello@baclab.co.uk, or see our contact page." Nowhere on the six indexable pages is there a legal entity name, Companies House number, VAT number, or geographic address, despite `config/brand.ts` clearly having `company.legalName` and `company.vatNumber` fields the layout is set up to render if populated (`app/layout.tsx`: `name: brand.company.legalName || brand.name`, `...(brand.company.vatNumber ? { vatID: ... } : {})`). This is both a trust (E-E-A-T) gap and a live compliance gap — UK Ecommerce Regulations 2002 reg.6 and the Consumer Contracts Regs both require a trader's geographic address to be given to consumers before and after a distance contract.
Fix: Populate `brand.company.legalName`, a registered/trading address, and (if VAT-registered) the VAT number in `config/brand.ts` so they flow into the Organization schema and render in the /contact and /terms "Our details" sections. This is the single highest-leverage trust fix on the site.

**[High] Zero first-hand experience or expertise signals — no About page, no author, no sourcing/manufacturing detail**
Location: sitewide (no About page exists among the six indexable routes).
Issue: There is no page or section establishing who BacLab is, who formulates or bottles the product, where it is manufactured, or what quality-control/testing regime it follows beyond generic assertions ("we take care to describe the product accurately" — disclaimer §5). No batch photos, no certificate-of-analysis sample, no lab/facility description, no named individual or team. For a product in a regulated-adjacent category (injectable-diluent-adjacent, benzyl-alcohol-preserved, sold to a research/bio-hacking-adjacent audience) this is the weakest E-E-A-T dimension on the site — Experience and Authoritativeness both score low because there is nothing to independently verify.
Fix: Add a short "About/Who we are" section (even a few paragraphs on the homepage or a dedicated page) naming the responsible business, its sourcing/QC process, and how batch certificates of analysis are supplied (disclaimer §5 already references "any certificate we supply with the batch" — surface that as a real content asset, e.g. a sample CoA or a statement of testing standard).

**[Medium] Contact-page email is Cloudflare-obfuscated and unreadable in raw HTML/AI crawlers**
Location: /contact, and every footer "Support" block sitewide.
Issue: All mailto links route through `/cdn-cgi/l/email-protection#...` and the visible anchor text in the raw HTML is the literal placeholder `[email&#160;protected]`, decoded to a real address only by Cloudflare's client-side JS. Extracted plain text confirms this: "Email [email&#160;protected]" is what a non-JS fetch (and most AI/LLM crawlers, which typically don't execute Cloudflare's rot13 decode script) will actually see. The one exception is the Organization JSON-LD, which does carry the real address (`hello@baclab.co.uk`) in plain text.
Fix: Either drop Cloudflare email obfuscation for the primary support address (spam risk is low for a low-volume contact address and is already mitigated by Cloudflare's WAF/bot rules at the edge) or supplement it with the plain-text address inside the JSON-LD (already present) and consider a `mailto:` fallback that degrades to real text for crawlers that don't run JS.

**[Info] Home H1 — brief flagged as "long", found to be within normal range, but keyword-thin**
Location: home.html, `<h1 id="hero-heading">`.
Issue: "Bacteriostatic water, sealed at ten millilitres." is 48 characters / 7 words — not long by conventional standards. It does not, however, carry the two commercial modifiers the title tag targets ("Buy" and "UK"): the `<title>` is "Buy Bacteriostatic Water UK — 10ml vial, £5.99 | BacLab" but the H1 drops "buy" and "UK" entirely, so the page's strongest on-page relevance signal for the money keyword "buy bacteriostatic water uk" sits only in the `<title>` and the H3 "Buy Bacteriostatic Water" three lines below it.
Fix: Not urgent — this is a minor missed reinforcement, not a defect. If revised, a variant like "Buy bacteriostatic water — sealed 10ml vials" would tie the H1 to the title-tag keyword without becoming a keyword-stuffed sentence.

**[Low] Identical og:title/og:description across all 6 pages**
Location: sitewide — verified in raw HTML of home, returns, contact, terms, privacy, disclaimer (`og:title` is "Buy Bacteriostatic Water UK — 10ml vial, £5.99" on every single page, sourced from the single static `TITLE`/`DESCRIPTION` constants in app/layout.tsx with no per-route override).
Issue: `<title>` and meta description ARE correctly unique per page (see table below), but Open Graph/Twitter Card metadata is not overridden per route, so a link to /privacy or /terms shared on social platforms, Slack, or an AI-answer-engine preview card shows the homepage's commercial title/description instead of "Privacy policy | BacLab". This weakens topical clarity for anything that renders link-preview cards rather than reading `<title>`.
Fix: Add per-page `openGraph`/`twitter` metadata overrides (Next.js route-level `generateMetadata` or static `metadata` export) mirroring the already-unique `<title>`/description values shown below.

**[Low] Thin unique content on /contact, diluted further by repeated boilerplate**
Location: contact.html.
Issue: Extracted body text is 130 words total, and roughly 60% of that is the sitewide nav/footer block (Policies list, Support block, disclaimer footer) repeated verbatim from every other page. The page-unique content is effectively one sentence ("Questions about an order, delivery or a return.") plus the email link. This is acceptable for a contact-page *type* but is the thinnest page on the site and offers nothing an AI system could cite distinctly from the footer already present everywhere else.
Fix: Add 2-3 short paragraphs: expected response time, whether support covers pre-sale product questions vs. post-sale order issues, and (once fixed per the High finding above) the registered business details. This also gives the page something unique enough to rank/be cited independently of the boilerplate footer.

**[Positive/Info] Medical/therapeutic-claim discipline is genuinely strong — no flags found**
Location: sitewide footer, disclaimer.html §§2-3, terms.html §3/§8, home.html FAQ block, Product JSON-LD description.
Evidence: Every single page carries the identical, explicit footer disclaimer: "Sold as a laboratory reagent for research use. Not a medicine and not a medical device. Not supplied for human or veterinary use, and not for administration to humans or animals. No therapeutic claim is made." The home-page FAQ directly rebuts the most likely misreading ("Does bacteriostatic water sterilise a contaminated vial? No... It is a preservative, not a steriliser"), and terms.html §8 contractually prohibits the *customer* from representing the product as medicinal. The Product schema description is also clean ("sterile diluent and solvent, used to reconstitute or dilute substances for laboratory and research purposes") with no dosing, administration, or health-outcome language anywhere. No copy on any of the six pages implies therapeutic, diagnostic, or human/veterinary use. This is best-practice for the category and should be preserved verbatim in any future copy changes.

**[Info] Keyword targeting is natural, not stuffed**
Location: home.html.
Evidence: In ~1,128 words of body text, "bacteriostatic water" occurs 9 times (~0.8% density) and the exact commercial phrase "buy bacteriostatic water" occurs once (in the H3 "Buy Bacteriostatic Water" above the bundle selector). "Vial" occurs 60 times, but that is unavoidable product-unit terminology across an 8-tier bundle table, not keyword manipulation. No evidence of stuffing on any page.
Fix: None needed. Optional: the exact phrase "buy bacteriostatic water uk" (matching the title tag) never appears verbatim in body copy — a single natural instance (e.g. in the opening paragraph or a bundle-table caption) would tie body content more tightly to the title-tag target without affecting readability.

**[Info] AI citation readiness is strong**
Location: home.html.
Evidence: FAQPage, Product, and Organization JSON-LD are all present and well-formed (verified from raw script tags). The home-page FAQ block pairs short, declarative, self-contained Q&A pairs ("What is bacteriostatic water? Sterile water containing 0.9% benzyl alcohol as a bacteriostatic preservative...") that are directly excerptable by an LLM without needing surrounding context. Legal pages (terms/returns/privacy/disclaimer) all carry numbered H2 sections with an "On this page" in-page TOC, giving AI crawlers a clean hierarchical structure to cite specific clauses (e.g. "returns.html §2, the exception for sealed goods") rather than undifferentiated prose.
Fix: None required; consider adding FAQPage schema to disclaimer.html and returns.html too, since both already read as natural Q&A-style sections but currently only home.html carries the schema markup.

**[Info] Legal pages are not thin — comprehensive and jurisdiction-specific**
Location: terms.html (2,547 words), privacy.html (1,876 words), returns.html (1,352 words), disclaimer.html (919 words).
Evidence: All four cite specific, correctly-numbered UK statutes and regulations (Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 reg.28(3)(b), Consumer Rights Act 2015, UK GDPR/Data Protection Act 2018, PECR reg.22(3), Consumer Protection Act 1987 Part I) rather than generic template boilerplate, and privacy.html specifically states no cookies/analytics/tracking scripts run on the site — an unusually transparent, verifiable trust claim. "Last updated 4 September 2026" is present and current on all four, a good freshness signal.
Fix: None — this is a content-quality strength, not a gap.

**[Info] Internal linking and anchor text — clean throughout**
Location: sitewide.
Evidence: All cross-links between the six pages use descriptive, specific anchor text ("returns and refunds policy", "product disclaimer", "terms and conditions", "contact page", "UK price match guarantee") — no generic "click here"/"read more" anchors found anywhere. Footer cross-links every legal page to every other legal page consistently.
Fix: None needed.

---

## Title / Meta Description Table

| Page | Title (chars) | Meta description (chars) | Unique? |
|---|---|---|---|
| / | Buy Bacteriostatic Water UK — 10ml vial, £5.99 \| BacLab (55) | Sealed multi-dose 10ml vial with 0.9% benzyl alcohol, £5.99 — down to £2.75 a vial in bulk. Sold as a laboratory and research diluent. (134) | Yes |
| /returns | Returns and refunds \| BacLab (28) | Your right to cancel, how to return an order, and how refunds are handled. (74) | Yes |
| /contact | Contact \| BacLab (16) | How to get in touch. (20) | Yes |
| /terms | Terms and conditions \| BacLab (29) | The terms on which we sell bacteriostatic water, and the terms of use of this site. (83) | Yes |
| /privacy | Privacy policy \| BacLab (23) | What personal data we collect, why, who we share it with, and your rights. (74) | Yes |
| /disclaimer | Product disclaimer \| BacLab (27) | What this product is sold as, what it is not, and the limits of what we can be responsible for. (95) | Yes |

All six titles and descriptions are unique, correctly intent-matched to page purpose, and within safe SERP-truncation length. No duplication found on `<title>` or `<meta name="description">` (duplication exists only on `og:title`/`og:description`, see Low finding above).

---

## What works

The site pairs unusually rigorous, jurisdiction-correct legal content with an airtight, consistently-repeated non-therapeutic disclaimer on every page — genuinely rare discipline for this product category and the strongest asset in the audit. On-page mechanics (unique titles/descriptions, clean H1→H2→H3 hierarchy, descriptive internal anchors, FAQ/Product/Organization schema) are well executed and need only minor polish.

## Scores

- **Content Quality: 58/100** — held down by the missing trader identity and the near-total absence of Experience/Authoritativeness signals (no About page, no sourcing/QC detail, no third-party validation); held up by accurate, current, jurisdiction-specific legal writing and exemplary non-therapeutic-claim discipline.
- **On-Page SEO: 78/100** — unique titles/descriptions, clean heading hierarchy, strong structured data, and natural (non-stuffed) keyword usage; docked for the sitewide duplicate og:title/description, the crawler-unreadable obfuscated contact email, and the H1/title keyword mismatch.
