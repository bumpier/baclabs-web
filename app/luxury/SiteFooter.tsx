import Link from "next/link";
import { CookieSettingsButton } from "@/components/commerce/CookieSettingsButton";
import { SignupForm } from "@/components/commerce/SignupForm";
import { Wordmark } from "@/brands/luxury/components/Marks";
import { LETTERS } from "@/brands/luxury/copy/home";
import { FOOTER } from "@/brands/luxury/copy/site";
import { tradingAs } from "@/lib/commerce/legal";
import { brand, STOREFRONT } from "./site";

/**
 * Every page's footer, set in small capitals: letters from the brand (the
 * kit's signup form, while the brand keeps a list), its own pages under its
 * name and the legal ones, "Cookie settings" (which renders only while the site runs
 * a tracker), the product disclaimer and, once it is filled in, the company
 * that trades as the brand. It ends on the wordmark, the width of the page.
 */
export function SiteFooter() {
  const company = brand.company ?? {};
  const list = STOREFRONT.mailingList;
  return (
    <footer className="lv-footer">
      <div className="lv-wrap lv-footer__grid">
        {list ? (
          <section aria-labelledby="letters-heading" className="lv-letters">
            <h2 id="letters-heading" className="lv-letters__heading">
              {LETTERS.heading}
            </h2>
            <p className="lv-letters__lede">{LETTERS.lede}</p>
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
                form: "lv-signup",
                row: "lv-signup__row",
                input: "lv-input",
                button: "lv-button lv-button--quiet",
                consent: "lv-signup__consent",
                link: "lv-link",
                done: "lv-letters__lede",
              }}
            />
          </section>
        ) : null}

        <nav aria-label={FOOTER.label} className="lv-footer__nav">
          <div>
            <h2 className="lv-footer__heading">{brand.name}</h2>
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
            <h2 className="lv-footer__heading">{FOOTER.infoHeading}</h2>
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
              <CookieSettingsButton asListItem ga4Id={STOREFRONT.tracking.ga4Id} className="lv-footer__cookie">
                {FOOTER.cookies}
              </CookieSettingsButton>
            </ul>
          </div>
        </nav>
      </div>

      <div className="lv-wrap lv-footer__legal">
        <p>{brand.disclaimer}</p>
        {brand.legalName ? (
          <p>
            {tradingAs(brand)}
            {company.number ? `, ${FOOTER.companyNo} ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
          </p>
        ) : null}
      </div>

      <div className="lv-footer__signature">
        <Wordmark />
      </div>
    </footer>
  );
}
