import { getMetaPixelId } from "@/lib/settings";

/**
 * The Meta Pixel bootstrap, served as a script at request time.
 *
 * WHY A ROUTE AND NOT AN INLINE SNIPPET. The storefront is a static
 * prerender, and the codebase works hard to keep it that way (see the note on
 * the middleware matcher). Reading the pixel id inside the root layout would
 * either make every storefront visit dynamic, or — if cached — bake whatever
 * was configured at BUILD time into the prerendered HTML, so a redeploy would
 * silently drop the pixel until something revalidated. Serving the snippet
 * from its own route keeps the funnel static and resolves the id per request,
 * so a pixel added in /admin/settings survives redeploys and needs no rebuild.
 *
 * The response is short-cached: a browser that has already loaded a page this
 * minute reuses it, and a change in the admin panel is live within 60s.
 */

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=600";

function javascript(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
      // The body is derived from a setting; never let a proxy guess otherwise.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(): Promise<Response> {
  const pixelId = await getMetaPixelId();

  // A 200 with an empty body rather than a 404: the tag is on every page, and
  // an unconfigured pixel is a normal state, not an error worth logging in
  // every visitor's console.
  if (!pixelId) {
    return javascript("/* Meta Pixel not configured. Add one in /admin/settings. */\n");
  }

  // pixelId has already been checked against /^[0-9]{8,20}$/ by lib/settings,
  // and JSON.stringify quotes it — there is no path from operator input to
  // executable code here.
  return javascript(`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
`);
}
