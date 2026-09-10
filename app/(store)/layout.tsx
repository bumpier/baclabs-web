import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { contentHref } from "@/lib/blog-migration";

/**
 * Bound how long any cache may hold a storefront page. Fully static pages
 * ship `s-maxage=31536000`, which is safe only while Cloudflare declines to
 * cache HTML; one cache rule change would then serve year-old prices. With
 * a five-minute revalidation the header becomes `s-maxage=300` and a price
 * change is live within minutes of a deploy, whatever sits in front. Pages
 * that opt into `force-dynamic` (/privacy) are unaffected.
 */
export const revalidate = 300;

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First in the tab order on every storefront page. Off screen until
          focused, so it costs sighted users nothing and saves keyboard and
          screen-reader users the header on every single page. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header guidesHref={contentHref("/guides")} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
