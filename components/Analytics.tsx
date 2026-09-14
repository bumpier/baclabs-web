"use client";

import Script from "next/script";
import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { mayLoadTrackers } from "@/lib/consent";
import { GA4_ID, useConsent } from "@/components/consent/consent-store";

/**
 * Mounts whichever analytics providers are configured, and re-fires a page
 * view on client-side navigation — which the vendor snippets do not do on
 * their own under the App Router.
 *
 * The two providers are configured differently, on purpose:
 *
 *  - META PIXEL — runtime. Once the visitor consents the tag below renders,
 *    and /api/pixel returns either the bootstrap or an empty file depending
 *    on what is set in /admin/settings. An operator can therefore add a pixel without a
 *    rebuild, and it survives redeploys. See app/api/pixel/route.ts for why
 *    it is a route rather than an inline snippet.
 *  - GA4 — still NEXT_PUBLIC_GA4_ID, inlined at BUILD time. Setting it later
 *    and only restarting the server will not take effect; you must rebuild.
 *    Move it to lib/settings.ts the same way if that ever becomes a chore.
 *
 * CONSENT GATE. Both set their own cookies, so NEITHER tag renders until the
 * visitor accepts on the cookie banner (components/consent/CookieBanner.tsx).
 * Undecided is treated as a refusal. When a visitor accepts mid-visit the
 * tags mount there and then, and the bootstraps fire the PageView for the
 * page they are on. Events fired before that are dropped, which is correct:
 * they happened without consent.
 */
export function Analytics() {
  const consented = mayLoadTrackers(useConsent());

  return (
    <>
      {consented ? <Script id="meta-pixel" src="/api/pixel" strategy="afterInteractive" /> : null}

      {consented && GA4_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
window.gtag=gtag;
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
          </Script>
        </>
      ) : null}

      {/* useSearchParams() forces a client-side bail-out unless it sits under
          a Suspense boundary, and this renders in the ROOT layout — without
          the boundary every statically prerendered page would deopt. It used
          to render only when a build-time id was set, which is why the
          storefront never hit this; the pixel is runtime now, so it always
          mounts and the boundary is mandatory. */}
      <Suspense fallback={null}>
        <RouteChangePageViews />
      </Suspense>
    </>
  );
}

/** Fires a page view on every soft navigation after the first paint. */
function RouteChangePageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The vendor snippets already fire the initial view; skip the first run so
  // the landing page is not counted twice.
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }
    const qs = searchParams.toString();
    trackPageView(`${window.location.origin}${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, searchParams]);

  return null;
}
