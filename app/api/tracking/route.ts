import { getMetaPixelId } from "@/lib/settings";

/**
 * Which consent-requiring trackers this deployment runs, for the cookie
 * banner to decide whether there is anything to ask about.
 *
 * The Meta Pixel is a RUNTIME setting (lib/settings.ts), so the static
 * storefront cannot know it at build time. This is the same reason
 * app/api/pixel/route.ts is a route. GA4 is build-time and is answered in
 * the client bundle, so it is not reported here.
 *
 * Returns booleans only. The pixel id itself is not a secret, but the banner
 * has no use for it.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const metaPixel = (await getMetaPixelId()) !== null;
  return Response.json(
    { metaPixel },
    {
      headers: {
        // Same window as /api/pixel, so the banner and the tag agree.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    }
  );
}
