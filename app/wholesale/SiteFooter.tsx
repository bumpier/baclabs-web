import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { FOOTER } from "@/brands/wholesale/copy/pages";
import { brand, STOREFRONT } from "./site";

/**
 * The footer, on the steel band: the legal pages, the contact and quote
 * pages and "Cookie settings" on every page, as the law and the cookie
 * banner's promise need, then the product disclaimer and, once it is set,
 * the trading party's legal line.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  return (
    <footer className="wh-footer">
      <div className="wh-wrap grid gap-8 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:py-12">
        <div>
          <p className="text-base font-extrabold text-white [font-stretch:125%]">{brand.name}</p>
          <p className="mt-2 max-w-[44ch]">{FOOTER.summary}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {FOOTER.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="link inline-flex min-h-10 items-center">
                  {l.label}
                </Link>
              </li>
            ))}
            <CookieSettingsButton
              asListItem
              ga4Id={STOREFRONT.tracking.ga4Id}
              className="link inline-flex min-h-10 cursor-pointer items-center text-left"
            />
          </ul>
        </nav>
        <div className="border-t border-white/15 pt-6 md:col-span-2">
          <p className="max-w-[80ch]">{brand.disclaimer}</p>
          {brand.legalName ? (
            <p className="mt-2">
              {brand.legalName}
              {company.number ? `, no. ${company.number}` : ""}
              {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
