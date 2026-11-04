import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { FOOTER } from "@/brands/luxury/copy/site";
import { brand, STOREFRONT } from "./site";

/**
 * Every page's footer: the wordmark, the legal pages, the concierge and
 * "Cookie settings" (which renders only while the site runs a tracker), as
 * the law and the cookie banner's promise need, then the product disclaimer
 * and, once it is filled in, the company that trades as the brand.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  return (
    <footer className="rx-footer">
      <div className="rx-wrap">
        <div className="rx-footer__inner">
          <p className="rx-footer__mark">{brand.name}</p>
          <nav aria-label={FOOTER.label} className="rx-footer__nav">
            <ul>
              <li>
                <Link href="/contact">{FOOTER.concierge}</Link>
              </li>
              <li>
                <Link href="/terms">{FOOTER.terms}</Link>
              </li>
              <li>
                <Link href="/privacy">{FOOTER.privacy}</Link>
              </li>
              <li>
                <Link href="/returns">{FOOTER.returns}</Link>
              </li>
              <li>
                <Link href="/disclaimer">{FOOTER.disclaimer}</Link>
              </li>
              <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id}>
                {FOOTER.cookies}
              </CookieSettingsButton>
            </ul>
          </nav>
        </div>
        <p className="rx-footer__small">{brand.disclaimer}</p>
        {brand.legalName ? (
          <p className="rx-footer__small">
            {brand.legalName}
            {company.number ? `, ${FOOTER.companyNo} ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
