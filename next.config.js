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

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-eval is required in dev because webpack uses eval() for source maps.
      `script-src 'self' 'unsafe-inline'${
        process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
      } ${ANALYTICS}`,
      "style-src 'self' 'unsafe-inline'",
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
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The multi-product catalogue and the affiliate area are gone. These paths
  // never went live on this domain, but the redirects are free and stop any
  // stray link 404ing. Legal page URLs are deliberately NOT redirected —
  // /privacy keeps the address it has always had.
  async redirects() {
    return [
      { source: "/products", destination: "/", permanent: true },
      { source: "/products/:slug", destination: "/", permanent: true },
      { source: "/cart", destination: "/#buy", permanent: true },
      { source: "/auth/:path*", destination: "/", permanent: true },
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/refunds", destination: "/returns", permanent: true },
      { source: "/shipping", destination: "/delivery", permanent: true },
    ];
  },
};

module.exports = nextConfig;
