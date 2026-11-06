import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CONTACT, CRUMBS } from "@/brands/wholesale/copy/pages";
import { FORM_CLASSES } from "@/brands/wholesale/components/form-classes";
import { tradingAs } from "@/lib/commerce/legal";
import { brand, TRADE_TOPIC } from "../site";

export const metadata: Metadata = pageMetadata({
  title: CONTACT.title,
  description: CONTACT.description(brand.name),
  path: "/contact",
  brandId: brand.id,
});

/** The topics, decided on the server (lib/contact.ts must stay out of the browser). */
const TOPICS = brandContactTopics(TRADE_TOPIC ? { trade: TRADE_TOPIC } : {});

/**
 * The contact page. The form posts to /api/contact, which files the message
 * under this brand (from the Host) and sends it to this brand's inbox. No
 * general reply time is promised: only the operator can make that promise
 * (ContactForm's replyTime). The trade topic is offered here too, and the
 * quote page is the same route with that topic alone. The company's details
 * show once the profile holds them, and not before.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="bk-page">
      <JsonLd data={breadcrumbSchema(CONTACT.title, "/contact", brand.id)} />
      <nav aria-label="Breadcrumb" className="bk-wrap bk-crumbs">
        <ol>
          <li>
            <Link href="/">{CRUMBS.catalogue}</Link>
          </li>
          <li aria-current="page">{CONTACT.title}</li>
        </ol>
      </nav>
      <div className="bk-wrap">
        <div className="bk-page-head">
          <h1 className="bk-page-title">{CONTACT.title}</h1>
          <p className="bk-page-lede">{CONTACT.lede}</p>
        </div>

        <div className="bk-two bk-two-flip">
          <section aria-labelledby="form-heading" className="bk-panel">
            <h2 id="form-heading" className="bk-panel-head">
              {CONTACT.formHeading}
            </h2>
            <div className="bk-panel-body">
              <ContactForm topics={TOPICS} complaintAckDays={COMPLAINT_ACK_DAYS} messageMax={CONTACT_MESSAGE_MAX} classNames={FORM_CLASSES} />
            </div>
          </section>

          <aside aria-labelledby="side-heading">
            <h2 id="side-heading" className="bk-h3">
              {CONTACT.sideHeading}
            </h2>
            <ul className="bk-doc-list">
              <li>{CONTACT.orderAside}</li>
              <li>
                <span>
                  {CONTACT.quoteAside}{" "}
                  <Link href="/quote" className="link font-semibold text-spruce">
                    {CONTACT.quoteLink}
                  </Link>
                  .
                </span>
              </li>
              {inbox ? (
                <li>
                  <span>
                    {CONTACT.emailAside}{" "}
                    <a href={`mailto:${inbox}`} className="link">
                      {inbox}
                    </a>
                    .
                  </span>
                </li>
              ) : null}
            </ul>
            {brand.legalName ? (
              <p className="mt-6 text-sm text-ink-soft">
                {tradingAs(brand)}
                {company.number ? `, no. ${company.number}` : ""}
                {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
                {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
