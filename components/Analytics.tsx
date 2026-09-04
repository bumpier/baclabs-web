"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

/**
 * Mounts whichever analytics providers are configured, and re-fires a page
 * view on client-side navigation — which the vendor snippets do not do on
 * their own under the App Router.
 *
 * Renders nothing at all when neither env var is set.
 *
 * Note: both IDs are inlined at BUILD time. Setting them later and only
 * restarting the server will not take effect; you must rebuild.
 */
export function Analytics() {
  return (
    <>
      {PIXEL_ID ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
      ) : null}

      {GA4_ID ? (
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

      {PIXEL_ID || GA4_ID ? <RouteChangePageViews /> : null}
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
