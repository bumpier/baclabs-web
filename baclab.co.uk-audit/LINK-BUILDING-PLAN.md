# baclab.co.uk — Link Building Plan

Prepared 2026-09-08. Companion to `FULL-AUDIT-REPORT.md`.

## Authority phase assessment

**Phase: Foundation (brand-new site).** Not ambiguous.

| Signal | Evidence |
|---|---|
| Domain age | Registered 2026-09-04 (Nominet RDAP); status still "add period". Four days old. |
| Wayback | Zero snapshots. |
| Indexed pages | `site:baclab.co.uk` returns nothing. |
| Brand presence | No results for "BacLab" + bacteriostatic water; no knowledge panel; no news. |
| Apparent size | Solo/small operation; one product, no company identity published. |
| Backlinks | Effectively zero (no tool access, but a 4-day-old domain has none). |

The competing UK SERP for the head term is entirely single-product pages from small suppliers (UK Peptide Lab, Evolve Biolab, NextGen Labs, Nexyra Lab, Peptides Lab UK, UK Peptides). None shows strong brand signals either, so the bar to clear is low, but this site starts from nothing.

## Two constraints that shape every tactic

1. **No trader identity yet.** `config/brand.ts` has `company.legalName`, `companyNumber`, `address`, `vatNumber` and `sameAs` all empty. Entity stacking and citations depend on an identical Name / Address / Phone (NAP) everywhere. Until those fields are populated and rendered on the site, every profile created would either be incomplete or risk inconsistency. **This is step zero.**
2. **Category sensitivity.** Bacteriostatic water is bundled in the wider market with injectable research-peptide reconstitution. Expect profile-level policy friction on Google Business Profile, Meta, Instagram and paid PR wires. Every profile description must use the same register as the site: laboratory and research diluent, no therapeutic framing. Do not run Shopping ads or paid PR before a policy check (see audit).

## Top 3 recommended tactics

### 1. Entity stacking (weeks 1–3) — playbook `entity-stacking.md`

**Why:** Google has no idea BacLab exists. Twenty consistent, complete profiles on DR 90+ platforms are the fastest way to become a recognised entity, and the `sameAs` array in Organization schema ties them together. Expected: 15–25 referring domains in month one, mostly nofollow, which is normal and safe for a new business.

**First action:** populate `brand.company.*`, `brand.sameAs` and `brand.nameVariants` in `config/brand.ts` and deploy so the canonical NAP is live on `/contact`, `/terms`, footer and Organization JSON-LD before any profile is created.

Week 1 (spread over the week, one post on each):
- Google Business Profile (as an online retailer with a service area; verify)
- LinkedIn company page (all fields)
- X/Twitter, Facebook page, Instagram business, YouTube channel (one short product-handling video), Pinterest business
- Register in Google Search Console and Bing Webmaster Tools now (the audit needs this too)

Week 2:
- Crunchbase, About.me (founder), Medium (one explainer article in the site's register, linking home), Gravatar
- Trustpilot business profile (no reviews yet; that is fine, and it is a citation)
- Companies House listing is automatic once the company exists; link to it from `sameAs`

Week 3:
- Add every profile URL to `brand.sameAs`; redeploy; confirm in Rich Results Test
- Skip Wikidata for now: notability is not there yet. Revisit at month 6.

### 2. Citations and directories (weeks 2–4) — playbook `citations-directories.md`

**Why:** Directories are the only editorial-ish dofollow links available to a 4-day-old single-product store, and UK ones (Chamber of Commerce, FSB, Yell, Thomson Local, Scoot, FreeIndex, Cylex, 192.com) are DR 50–70. Expected: 10–15 referring domains.

**First action:** search `bacteriostatic water supplier directory uk`, `laboratory supplies directory uk` and `"research chemicals" directory uk`, and check where the six competitors above are listed. Replicate their directory footprint before anything else, then join the local Chamber of Commerce (paid, dofollow, DR 50–70).

Rules: 20–30 quality directories over three weeks, never hundreds in a day; identical NAP; brand name, not keyword, as the listing name; category "laboratory supplies / scientific equipment", not "pharmacy".

### 3. Network and supplier links (weeks 3–6) — from `new-site-launch-strategy.md`, e-commerce section

**Why:** 30–50% conversion versus 2–5% for cold outreach. Expected: 5–10 real editorial links.

**First actions:**
- Ask the vial manufacturer or wholesaler to list BacLab as an authorised UK stockist (permanent, relevant, often dofollow).
- Write genuine testimonials for the tools the business already uses (Stripe is unlikely, but the hosting provider, Resend, the crypto gateway, accountants, packaging supplier are all realistic) and ask for a link.
- Build a "Press / As seen in" page early so later mentions have a home.
- Offer a single vial to two or three UK lab-supply or biohacking-adjacent micro-bloggers (DR 20–40) for an honest write-up. Keep the brief strictly to the product as a diluent.

## Content that earns links later (month 2 onward)

The audit already identified the asset: a research-register explainer, "Bacteriostatic water vs sterile water", plus the guides, FAQ and calculator now in the tree. The per-ml calculator is the one genuinely link-worthy tool on the site. Once live and indexed, pitch it to resource pages found with `intitle:resources "laboratory" uk` and to the UK peptide/lab forums where the topic recurs. Skyscraper and guest posting are premature before month 3.

## Link velocity

| Period | Target new referring domains | Type |
|---|---|---|
| Month 1 | 15–25 | Profiles, citations, directories |
| Months 2–3 | 5–10 | Supplier, testimonial, first resource-page links |
| Months 4–6 | 8–15 | Guides, calculator, first guest post |
| Month 7+ | 10–30 | Only if DR is 20+ by then |

Red flags to avoid: 50+ links in a month, all links to the home page (distribute to the guides and calculator), any exact-match "bacteriostatic water uk" anchor above 5%. Anchor plan for the first 30 links: branded 50%, naked URL 20%, generic 20%, partial match 10%, exact match 0.

## Ignore

Fiverr/SEOClerks link packages, PBNs, link exchanges, and the many "peptide directory" sites with no traffic. Anything that requires describing the product beyond "laboratory and research diluent".

## Next step

After month one, run a keyword deep dive on "bacteriostatic water vs sterile water" and "bacteriostatic water 10ml" to decide which of the new pages the month-two links should point to.
