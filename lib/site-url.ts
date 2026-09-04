// Origin resolution for the multi-domain deployment.
//
// The storefront is served under many domains at once (see deploy/README.md).
// Two kinds of URL need different origins:
//
//  - Browser-context URLs (referral/recruit links, payment success/cancel
//    redirects) should stay on whichever storefront domain the visitor is
//    actually using → requestOrigin() / originFromHeaders().
//  - Out-of-band URLs that outlive the browsing session and must keep working
//    even if that domain gets blocked (transactional emails, the payment IPN
//    webhook callback) → canonicalOrigin(), a single stable configured domain.

const FALLBACK_ORIGIN = "http://localhost:3000";

/**
 * Stable, configured origin. Use for URLs delivered out-of-band — emails and
 * the payment IPN webhook callback — which must resolve to a domain you keep
 * alive regardless of which storefront domain the visitor came through.
 */
export function canonicalOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_ORIGIN;
}

/**
 * Derive the origin from request headers — the domain the visitor is actually
 * on. Honors the X-Forwarded-Host / X-Forwarded-Proto that nginx forwards.
 * Falls back to the canonical origin when the request carries no host.
 */
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return canonicalOrigin();
  // Behind nginx, X-Forwarded-Proto is always set. Without a proxy (local dev),
  // default to http for localhost and https for real hosts.
  const proto = h.get("x-forwarded-proto") ?? (isLocalhost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

function isLocalhost(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

/**
 * Request-host origin for Server Components and route handlers. Falls back to
 * the canonical origin when there is no request context.
 */
export async function requestOrigin(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return originFromHeaders(await headers());
  } catch {
    return canonicalOrigin();
  }
}
