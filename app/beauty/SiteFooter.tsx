import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { FOOTER } from "@/brands/beauty/copy/site";
import { Mark, Wordmark } from "@/brands/beauty/components/Wordmark";
import { brand, STOREFRONT } from "./site";

/**
 * The footer, a blush sheet: the mark and the promise, the shop's pages,
 * help, the legal pages and "Cookie settings" on every page, as the law and
 * the cookie banner's promise need, then the product disclaimer and, once
 * it is set, the company behind the name. It ends on the wordmark across
 * the whole sheet, blush on blush, with the seal the one point of colour.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  const link = "au-nav min-h-10 font-[450]";
  return (
    <footer className="au-sheet au-blush no-print mb-2.5 mt-24 overflow-hidden px-6 pt-14 sm:mb-5 sm:px-12 sm:pt-16 lg:mt-32">
      <div className="mx-auto grid max-w-[74rem] gap-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <Mark className="h-12 w-12 text-ink" />
          <p className="au-voice mt-5 max-w-[16rem] text-[1.625rem]">{FOOTER.tagline}</p>
        </div>
        <nav aria-label={FOOTER.navLabel} className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold">{FOOTER.shop}</h2>
            <ul className="mt-2">
              <li>
                <Link href="/#essentials" className={link}>
                  {FOOTER.essentials}
                </Link>
              </li>
              <li>
                <Link href="/#ritual" className={link}>
                  {FOOTER.ritual}
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
      <div className="au-fine mx-auto mt-14 max-w-[74rem] space-y-2">
        <p>{brand.disclaimer}</p>
        {brand.legalName ? (
          <p>
            {brand.name} is a trading name of {brand.legalName}
            {company.number ? `, company no. ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}.
          </p>
        ) : null}
      </div>
      <Wordmark ring className="mx-auto mt-10 block h-auto w-full max-w-[74rem] translate-y-[8%] text-blush-deep" />
    </footer>
  );
}
