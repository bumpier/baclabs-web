# Audit brief — baclab.co.uk (shared context for specialist agents)

Site: https://baclab.co.uk — single-product UK e-commerce funnel (Bacteriostatic Water, 10ml vial, £5.99, 8 bundle tiers), Next.js App Router behind Cloudflare. Source repo: /Users/liam/development/bacwater-website (read-only for you; do not edit source files).

Public indexable pages (6): / , /returns , /contact , /terms , /privacy , /disclaimer.
Private (noindex + robots disallow): /admin/*, /api/*, /checkout, /order-confirmation/*, /dev/*.
Also served: /robots.txt, /sitemap.xml, /llms.txt.

Raw snapshots (fetched 2026-09-08, use these before re-fetching): raw/home.html, raw/returns.html, raw/contact.html, raw/terms.html, raw/privacy.html, raw/disclaimer.html, plus matching *.headers files.
Relevant source files: app/layout.tsx (root metadata), app/(store)/page.tsx (home), app/sitemap.ts, app/robots.ts, lib/seo.ts, components/JsonLd.tsx, app/llms.txt/route.ts, config/funnel.ts, config/brand.ts, config/faq.ts, next.config.js.

Already observed:
- www.baclab.co.uk returns 200 (no redirect to apex). http:// -> 301 https apex. Trailing slash -> 308 strip.
- Old paths /products, /refunds 308 to correct targets.
- Security headers present (CSP, HSTS preload, X-Frame-Options). cache-control: s-maxage=31536000 on HTML.
- Plugin Python scripts unavailable (no Python 3.10+). Use curl, node, and reading the HTML directly.
- Product is sold strictly as a laboratory/research diluent; NO copy or schema may imply therapeutic/medical use. Flag any that does.

Write your findings to findings/<your-category>.md using: [SEVERITY] Title / Location / Issue (evidence) / Fix. Severity: Critical, High, Medium, Low, Info. End with a 0-100 category score and a 2-line "what works" note. Be page-specific; no generic advice.
