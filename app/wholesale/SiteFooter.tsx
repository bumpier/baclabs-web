import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { FOOTER } from "@/brands/wholesale/copy/pages";
import { Lockup } from "@/brands/wholesale/components/logo";
import { brand, STOREFRONT } from "./site";

/**
 * The footer, on spruce: the lockup and a line on what the site sells, the
 * links in three columns ("Cookie settings" under Legal on every page, as
 * the cookie banner promises), and the company's details as the profile
 * holds them. Each detail renders only once it is set: until the trading
 * party is configured the column holds the contact address alone, or
 * nothing. Then the product disclaimer.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  const details = [
    brand.legalName ? { term: FOOTER.company, detail: brand.legalName } : null,
    company.number ? { term: FOOTER.number, detail: company.number } : null,
    company.registeredAddress ? { term: FOOTER.address, detail: company.registeredAddress } : null,
    company.vatNumber ? { term: FOOTER.vat, detail: company.vatNumber } : null,
    brand.email.contact ? { term: FOOTER.email, detail: brand.email.contact } : null,
  ].filter((d): d is { term: string; detail: string } => d !== null);

  return (
    <footer className="vh-footer">
      <div className="vh-wrap">
        <div className="vh-footer-top">
          <div className="vh-footer-brand">
            <Lockup className="vh-lockup-footer" />
            <p>{FOOTER.summary}</p>
          </div>
          <nav aria-label="Footer" className="vh-footer-nav">
            {FOOTER.columns.map((col) => (
              <div key={col.heading}>
                <h2>{col.heading}</h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                  {col.heading === "Legal" ? (
                    <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="vh-footer-cookie" />
                  ) : null}
                </ul>
              </div>
            ))}
          </nav>
          {details.length > 0 ? (
            <dl className="vh-footer-company">
              {details.map((d) => (
                <div key={d.term}>
                  <dt>{d.term}</dt>
                  <dd>{d.detail}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <p className="vh-footer-legal">{brand.disclaimer}</p>
      </div>
    </footer>
  );
}
