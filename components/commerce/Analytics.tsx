"use client";

import Script from "next/script";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { mayLoadTrackers } from "@/lib/consent";
import { useConsent } from "@/components/consent/consent-core";
import { useBrandPathname } from "@/lib/brand/use-brand-pathname";
import { validGa4Id, type TrackingConfig } from "@/components/commerce/tracking";

/**
 * A brand's analytics tags, for its root layout. BacLab's is
 * components/Analytics.tsx, which reads BacLab's build-time GA4 id; this one
 * takes the brand's own:
 *
 *  - `ga4Id`: the brand's GA4 property (storefrontView's tracking.ga4Id).
 *    Empty or malformed loads no GA4.
 *  - `metaPixel`: whether to load the Host's pixel from /api/pixel, which
 *    resolves the brand's own pixel per request and serves an empty script
 *    when it has none. It is not an id on purpose: the id is a runtime
 *    setting (/admin/settings), and the server-side Purchase reads the same
 *    setting, so a prerendered id could disagree with it.
 *
 * Nothing loads until the visitor accepts on the cookie banner, as on
 * BacLab. With neither configured it renders nothing at all.
 */
export function Analytics({ ga4Id, metaPixel = true }: TrackingConfig) {
  const consented = mayLoadTrackers(useConsent());
  const ga4 = validGa4Id(ga4Id);
  if (!ga4 && !metaPixel) return null;

  return (
    <>
      {consented && metaPixel ? <Script id="meta-pixel" src="/api/pixel" strategy="afterInteractive" /> : null}

      {consented && ga4 ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
window.gtag=gtag;
gtag('js', new Date());
gtag('config', '${ga4}');`}
          </Script>
        </>
      ) : null}

      {/* useSearchParams() needs a Suspense boundary in a root layout, or
          every prerendered page would bail out to client rendering. */}
      <Suspense fallback={null}>
        <RouteChangePageViews />
      </Suspense>
    </>
  );
}

/** A page view on every soft navigation after the first paint, which the vendor snippets miss. */
function RouteChangePageViews() {
  const pathname = useBrandPathname();
  const searchParams = useSearchParams();
  // The snippets fire the landing page's view themselves.
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
