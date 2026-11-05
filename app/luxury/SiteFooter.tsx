import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { SignupForm } from "@/components/commerce/SignupForm";
import { Wordmark } from "@/brands/luxury/components/Marks";
import { LETTERS } from "@/brands/luxury/copy/home";
import { FOOTER } from "@/brands/luxury/copy/site";
import { tradingAs } from "@/lib/commerce/legal";
import { brand, STOREFRONT } from "./site";

/**
 * Every page's footer, set in small capitals: letters from the house (the
 * kit's signup form, while the brand keeps a list), the house's pages and
 * the legal ones, "Cookie settings" (which renders only while the site runs
 * a tracker), the product disclaimer and, once it is filled in, the company
 * that trades as the brand. It ends on the wordmark, the width of the page.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  const list = STOREFRONT.mailingList;
  return (
    <footer className="rv-footer">
      <div className="rv-wrap rv-footer__grid">
        {list ? (
          <section aria-labelledby="letters-heading" className="rv-letters">
            <h2 id="letters-heading" className="rv-letters__heading">
              {LETTERS.heading}
            </h2>
            <p className="rv-letters__lede">{LETTERS.lede}</p>
            <SignupForm
              config={{
                consentText: list.consentText,
                placeholder: LETTERS.placeholder,
                submitLabel: LETTERS.submit,
                pendingLabel: LETTERS.pending,
                doneMessage: LETTERS.done,
              }}
              source="inline"
              classNames={{
                form: "rv-signup",
                row: "rv-signup__row",
                input: "rv-input",
                button: "rv-button rv-button--quiet",
                consent: "rv-signup__consent",
                link: "rv-link",
                done: "rv-letters__lede",
              }}
            />
          </section>
        ) : null}

        <nav aria-label={FOOTER.label} className="rv-footer__nav">
          <div>
            <h2 className="rv-footer__heading">{FOOTER.houseHeading}</h2>
            <ul>
              <li>
                <Link href="/#buy">{FOOTER.shop}</Link>
              </li>
              <li>
                <Link href="/contact">{FOOTER.concierge}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="rv-footer__heading">{FOOTER.infoHeading}</h2>
            <ul>
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
              <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="rv-footer__cookie">
                {FOOTER.cookies}
              </CookieSettingsButton>
            </ul>
          </div>
        </nav>
      </div>

      <div className="rv-wrap rv-footer__legal">
        <p>{brand.disclaimer}</p>
        {brand.legalName ? (
          <p>
            {tradingAs(brand)}
            {company.number ? `, ${FOOTER.companyNo} ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
          </p>
        ) : null}
      </div>

      <div className="rv-footer__signature">
        <Wordmark />
      </div>
    </footer>
  );
}
