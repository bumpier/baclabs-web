import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { brand, STOREFRONT } from "./site";

/**
 * A plain footer until the brand's design lands: the legal pages, the
 * contact page and "Cookie settings" on every page, as the law and the
 * cookie banner's promise need.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-3xl border-t border-line px-6 py-10 text-sm text-ink-soft">
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href="/contact" className="link">
              Contact
            </Link>
          </li>
          <li>
            <Link href="/terms" className="link">
              Terms
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="link">
              Privacy
            </Link>
          </li>
          <li>
            <Link href="/returns" className="link">
              Returns
            </Link>
          </li>
          <li>
            <Link href="/disclaimer" className="link">
              Product disclaimer
            </Link>
          </li>
          <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="link" />
        </ul>
      </nav>
      <p className="mt-4">{brand.disclaimer}</p>
    </footer>
  );
}
