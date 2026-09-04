// Throwaway smoke test for the multi-domain origin helpers. Run with:
//   npx tsx scripts/smoke-site-url.ts
import { originFromHeaders, canonicalOrigin } from "../lib/site-url";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

// originFromHeaders — derives the origin the visitor is actually using
assert(
  originFromHeaders(h({ "x-forwarded-host": "shop2.com", "x-forwarded-proto": "https" })) ===
    "https://shop2.com",
  "uses x-forwarded-host + x-forwarded-proto"
);
assert(
  originFromHeaders(h({ "x-forwarded-host": "shop2.com", host: "127.0.0.1:3000" })) ===
    "https://shop2.com",
  "x-forwarded-host wins over host (we sit behind nginx)"
);
assert(
  originFromHeaders(h({ host: "shop3.com" })) === "https://shop3.com",
  "falls back to host when no x-forwarded-host, default proto https"
);
assert(
  originFromHeaders(h({ host: "localhost:3000", "x-forwarded-proto": "http" })) ===
    "http://localhost:3000",
  "honors x-forwarded-proto=http"
);
assert(
  originFromHeaders(h({ host: "localhost:3000" })) === "http://localhost:3000",
  "localhost defaults to http (dev without a proxy)"
);
assert(
  originFromHeaders(h({ host: "127.0.0.1:3000" })) === "http://127.0.0.1:3000",
  "127.0.0.1 defaults to http"
);

// No host header at all → fall back to the canonical configured origin
process.env.NEXT_PUBLIC_SITE_URL = "https://canonical.example";
assert(
  originFromHeaders(h({})) === "https://canonical.example",
  "no host header → canonical origin"
);

// canonicalOrigin — the stable, configured origin for out-of-band URLs
assert(
  canonicalOrigin() === "https://canonical.example",
  "canonicalOrigin returns NEXT_PUBLIC_SITE_URL"
);
delete process.env.NEXT_PUBLIC_SITE_URL;
assert(
  canonicalOrigin() === "http://localhost:3000",
  "canonicalOrigin falls back to localhost when unset"
);

console.log("\nAll site-url assertions passed.");
