import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LEARN_LINKS } from "@/components/Footer";
import { contentHref } from "@/lib/blog-migration";
import { PRODUCT, formatMinor } from "@/config/funnel";

/**
 * Branded 404. Next serves a real 404 status for this page, so it is never
 * indexed; the explicit noindex is belt and braces for any crawler that reads
 * the meta before the status. No canonical: the root layout's `/` canonical
 * would otherwise be inherited here, which is a conflicting signal on a page
 * that does not exist.
 *
 * Root-level `not-found.tsx` renders inside the root layout only, so it
 * repeats the store layout's shell (skip link, header, main, footer) to keep
 * the header and footer navigation — the whole point of a custom 404 is that
 * a visitor on a dead link can get to a live page in one click.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header guidesHref={contentHref("/guides")} />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">404</p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Page not found</h1>
          <p className="measure mt-4 text-base text-ink-soft">
            That address does not exist on this site. It may have been mistyped, or the page
            may have moved.
          </p>

          <p className="mt-8">
            <Link href="/#buy" className="btn-cta sm:w-auto">
              Buy {PRODUCT.name} &mdash; {formatMinor(PRODUCT.unitPriceMinor)}
            </Link>
          </p>

          <section className="mt-12">
            <h2 className="text-lg font-semibold">Popular pages</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/" className="link">
                  Home &mdash; {PRODUCT.name}, {PRODUCT.size}
                </Link>
              </li>
              {LEARN_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={contentHref(l.href)} className="link">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/contact" className="link">
                  Contact
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
