import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { FOOTER } from "@/brands/beauty/copy/site";
import { brand, STOREFRONT } from "./site";

/**
 * The footer, a blush sheet: the wordmark, the shop's two pages, help, the
 * legal pages and "Cookie settings" on every page, as the law and the
 * cookie banner's promise need, then the product disclaimer and, once it is
 * set, the company behind the name.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  const link = "inline-flex min-h-10 items-center hover:underline hover:decoration-rose hover:underline-offset-4";
  return (
    <footer className="au-sheet au-blush mb-2.5 mt-20 px-6 py-12 sm:mb-6 sm:px-12 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <p className="font-display text-[2.25rem] leading-none">{brand.name}</p>
          <p className="au-small mt-3">{FOOTER.tagline}</p>
        </div>
        <nav aria-label={FOOTER.navLabel} className="grid gap-8 text-[0.9375rem] sm:grid-cols-3">
          <div>
            <h2 className="font-semibold">{FOOTER.shop}</h2>
            <ul className="mt-2">
              <li>
                <Link href="/#essentials" className={link}>
                  {FOOTER.essentials}
                </Link>
              </li>
              <li>
                <Link href="/clinics" className={link}>
                  {FOOTER.clinics}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">{FOOTER.help}</h2>
            <ul className="mt-2">
              <li>
                <Link href="/contact" className={link}>
                  {FOOTER.contact}
                </Link>
              </li>
              <li>
                <Link href="/returns" className={link}>
                  {FOOTER.returns}
                </Link>
              </li>
              <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className={`${link} cursor-pointer`}>
                {FOOTER.cookies}
              </CookieSettingsButton>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">{FOOTER.policies}</h2>
            <ul className="mt-2">
              <li>
                <Link href="/terms" className={link}>
                  {FOOTER.terms}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={link}>
                  {FOOTER.privacy}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className={link}>
                  {FOOTER.disclaimer}
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="au-small mx-auto mt-12 max-w-6xl space-y-2">
        <p>{brand.disclaimer}</p>
        {brand.legalName ? (
          <p>
            {brand.name} is a trading name of {brand.legalName}
            {company.number ? `, company no. ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}.
          </p>
        ) : null}
      </div>
    </footer>
  );
}
