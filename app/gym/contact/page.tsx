import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CONTACT } from "@/brands/gym/copy/site";
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

/** Where most messages start: a parcel. Any ?topic= link still wins. */
const DEFAULT_TOPIC = "delivery";

/** The kit's form in this brand's slots (brands/gym/styles.css, "Contact"). */
const FORM_CLASSES = {
  form: "gym-form",
  label: "gym-form-label",
  input: "gym-field",
  hint: "gym-form-hint",
  error: "alert-error",
  button: "gym-btn gym-btn-ink gym-btn-lg w-full sm:w-auto",
  note: "gym-form-note",
  link: "gym-link",
  sent: "gym-sent",
  sentHeading: "gym-sent-heading",
  sentText: "gym-sent-text",
  again: "gym-link mt-4 text-sm",
};

/**
 * The contact page: the heading on black, then the form on a white panel
 * and, beside it, two things worth knowing before writing. The form posts to
 * /api/contact, which files the message under this brand (from the Host) and
 * sends it to this brand's inbox. No general reply time is promised: only
 * the operator can make that promise (ContactForm's replyTime).
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" tabIndex={-1} className="gym-page outline-none">
      <JsonLd data={breadcrumbSchema(CONTACT.title, "/contact", brand.id)} />
      <div className="gym-page-band">
        <div className="gym-wrap gym-page-band-inner">
          <h1 className="gym-page-title">{CONTACT.heading}</h1>
          <p className="gym-page-lead">
            {CONTACT.lead}
            {inbox ? (
              <>
                {" "}
                {CONTACT.orEmail}{" "}
                <a href={`mailto:${inbox}`} className="gym-link">
                  {inbox}
                </a>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <div className="gym-tape" aria-hidden="true" />
      </div>

      <div className="gym-wrap gym-page-body">
        <div className="gym-contact-grid">
          <div className="gym-form-panel">
            <ContactForm
              topics={TOPICS}
              defaultTopic={DEFAULT_TOPIC}
              complaintAckDays={COMPLAINT_ACK_DAYS}
              messageMax={CONTACT_MESSAGE_MAX}
              text={CONTACT.form}
              classNames={FORM_CLASSES}
            />
          </div>
          <aside aria-labelledby="before-heading" className="gym-aside">
            <h2 id="before-heading" className="gym-aside-heading">
              {CONTACT.asideHeading}
            </h2>
            <ul className="gym-aside-list">
              <li>{CONTACT.order}</li>
              <li>
                {CONTACT.returns}{" "}
                <Link href="/returns" className="gym-link">
                  {CONTACT.returnsLink}
                </Link>
                .
              </li>
            </ul>
            {brand.legalName ? (
              <p className="gym-company">
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
