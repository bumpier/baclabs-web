/** @type {import('next').NextConfig} */

// Analytics hosts are allow-listed unconditionally rather than switched on
// only when the env vars are set. The previous CSP omitted them entirely,
// which meant configuring the Meta Pixel silently reported NOTHING: the
// inline bootstrap ran, then its fbevents.js injection was blocked. An
// allow-list entry for a script that never loads costs nothing; a missing one
// costs you every conversion, invisibly.
const META = ["https://connect.facebook.net", "https://www.facebook.com"];
const GA = ["https://www.googletagmanager.com", "https://www.google-analytics.com"];
const ANALYTICS = [...META, ...GA].join(" ");
// Trustpilot TrustBox: the bootstrap script, then an iframe per widget.
const TRUSTPILOT = "https://widget.trustpilot.com";

// ── Brand hosts (brands/hosts.json: id -> hosts, for every brand but
// BacLab). The same regex body as brandHostPattern() in
// lib/brand/resolve.ts, which is TypeScript and cannot be required here;
// `npm run test:hosts` checks the two agree.
const BRAND_HOSTS = require("./brands/hosts.json");
const ALL_BRAND_HOSTS = Object.values(BRAND_HOSTS).flat();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BRAND_HOST_PATTERN = `(?:${ALL_BRAND_HOSTS.map(escapeRegex).join("|")})`;
// Redirects run before middleware, on every host, so without this BacLab's
// /cart or /refunds would redirect on a brand's domain too.
const NOT_ON_BRAND_HOSTS = [{ type: "host", value: BRAND_HOST_PATTERN }];

// No header ever names a brand's domain: a CSP on baclab.co.uk listing the
// brands' hosts would tie them together for anyone who reads it. The one
// place the admin shows another brand's image, the packing slip, inlines it
// as a data: URI (lib/brand/logo.ts), which img-src already allows.
function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    // unsafe-eval is required in dev because webpack uses eval() for source maps.
    `script-src 'self' 'unsafe-inline'${
      process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
    } ${ANALYTICS} ${TRUSTPILOT}`,
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${TRUSTPILOT}`,
    // next/font self-hosts, so no external font host is needed.
    "font-src 'self'",
    `img-src 'self' data: blob: ${ANALYTICS}`,
    `connect-src 'self' ${ANALYTICS}`,
    // Card checkout is a top-level navigation to Stripe (window.location),
    // not a form POST, so Stripe does not need a form-action entry.
    "form-action 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// The admin's own headers, on top of the site-wide ones (its CSP is theirs).
const adminHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

// Host of the canonical origin, for the www → apex redirect below. Empty when
// NEXT_PUBLIC_SITE_URL is unset or already a www host, in which case no
// redirect is emitted.
const SITE_HOST = (() => {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL || "").host;
    return host.startsWith("www.") ? "" : host;
  } catch {
    return "";
  }
})();

const nextConfig = {
  poweredByHeader: false,
  // Loaded from node_modules at runtime rather than bundled: zip.js carries a
  // WebAssembly fallback and worker scripts the server bundler would mangle.
  // The image ships full node_modules (see Dockerfile), so it is there.
  serverExternalPackages: ["@zip.js/zip.js"],
  experimental: {
    // Inline the stylesheet into the HTML. The one render-blocking resource
    // on the home page was a 14KB synchronous <link rel="stylesheet">, and
    // 96% of the measured LCP was element render delay waiting on it. Inline
    // CSS paints on the first byte of HTML. The stylesheet is small enough
    // that losing its separate cache entry costs less than the round trip.
    inlineCss: true,
    // app/global-not-found.tsx answers every URL no route matches. Each site
    // has its own root layout and there is none above them, so without it an
    // unmatched URL would get Next's bare 404 instead of BacLab's.
    globalNotFound: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Defence in depth for the admin area: robots.txt stops crawling and
      // the layout metadata says noindex, but a header reaches non-HTML
      // responses and any crawler that reads headers before the body.
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
    ];
  },
  // The brands' development hosts (brands/hosts.json): `next dev` refuses
  // its own dev resources to an origin it does not know.
  allowedDevOrigins: ["*.localhost"],
  // The affiliate area is gone. These paths never went live on this domain,
  // but the redirects are free and stop any stray link 404ing. Legal page
  // URLs are deliberately NOT redirected — /privacy keeps the address it has
  // always had.
  //
  // /products AND /products/:slug USED TO REDIRECT HERE, from when the
  // multi-product catalogue was removed and the site became a single funnel.
  // They are now the pack pages (config/products.ts) and must NOT be
  // redirected: a 308 to "/" made every one of them unreachable and
  // unindexable, which is the precise opposite of why they exist.
  //
  // Every one of BacLab's redirects stands down on a brand host
  // (NOT_ON_BRAND_HOSTS): they are BacLab's URLs, not the brands'.
  async redirects() {
    const baclab = [
      // www → apex. The canonical tag already points every www page at the
      // apex, but a tag is a hint; a 301 is the consolidation. Only the www
      // variant of the canonical host is redirected, so any other storefront
      // domain this deployment serves is untouched.
      ...(SITE_HOST
        ? [
            {
              source: "/:path*",
              has: [{ type: "host", value: `www.${SITE_HOST}` }],
              destination: `https://${SITE_HOST}/:path*`,
              permanent: true,
            },
          ]
        : []),
      // The 7- and 8-vial tiers were retired on 11 Sept 2026 (see the note in
      // config/funnel.ts) and their pack pages went with them. Each goes to
      // the nearest surviving size rather than to /products, so anyone who
      // followed an old link lands on a pack they can actually buy: 7 down to
      // the 5, 8 up to the 10.
      {
        source: "/products/bacteriostatic-water-10ml-7-vials",
        destination: "/products/bacteriostatic-water-10ml-5-vials",
        permanent: true,
      },
      {
        source: "/products/bacteriostatic-water-10ml-8-vials",
        destination: "/products/bacteriostatic-water-10ml-10-vials",
        permanent: true,
      },
      { source: "/cart", destination: "/#buy", permanent: true },
      { source: "/auth/:path*", destination: "/", permanent: true },
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/refunds", destination: "/returns", permanent: true },
      // Guide retired; its subject is covered by the "what is" guide.
      { source: "/guides/benzyl-alcohol-in-bacteriostatic-water", destination: "/guides/what-is-bacteriostatic-water", permanent: true },
      // There is no /delivery page — the delivery terms sit in the trust bar
      // and purchase block on the home page, so that is where /shipping goes.
      { source: "/shipping", destination: "/", permanent: true },
    ];
    // Each brand's www host to its apex, for a brand that lists both.
    const brandWww = Object.values(BRAND_HOSTS).flatMap((list) =>
      list
        .filter((h) => h.startsWith("www.") && list.includes(h.slice(4)))
        .map((h) => ({
          source: "/:path*",
          has: [{ type: "host", value: escapeRegex(h) }],
          destination: `https://${h.slice(4)}/:path*`,
          permanent: true,
        }))
    );
    return [...baclab.map((r) => ({ ...r, missing: NOT_ON_BRAND_HOSTS })), ...brandWww];
  },
};

module.exports = nextConfig;
