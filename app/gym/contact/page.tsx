import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CONTACT } from "@/brands/gym/copy/site";
import { brand, TRADE_TOPIC } from "../site";

export const metadata: Metadata = pageMetadata({
  title: CONTACT.title,
  description: CONTACT.description(brand.name),
  path: "/contact",
  brandId: brand.id,
});

/** The topics, decided on the server (lib/contact.ts must stay out of the browser). */
const TOPICS = brandContactTopics(TRADE_TOPIC ? { trade: TRADE_TOPIC } : {});

/** The kit's form in this brand's slots (brands/gym/styles.css, "The kit's contact form"). */
const FORM_CLASSES = {
  form: "gym-form",
  label: "gym-form-label",
  input: "gym-input",
  hint: "gym-form-hint",
  error: "alert-error",
  button: "gym-btn gym-btn-lg w-full sm:w-auto",
  note: "gym-form-note",
  link: "gym-link",
  sent: "gym-sent",
  sentHeading: "gym-sent-heading",
  sentText: "gym-sent-text",
  again: "gym-link mt-4 text-sm",
};

/**
 * The contact page. The form posts to /api/contact, which files the message
 * under this brand (from the Host) and sends it to this brand's inbox. No
 * general reply time is promised: only the operator can make that promise
 * (ContactForm's replyTime).
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" tabIndex={-1} className="gym-page outline-none">
      <JsonLd data={breadcrumbSchema(CONTACT.title, "/contact", brand.id)} />
      <div className="gym-wrap">
        <div className="gym-narrow">
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

          <div className="mt-10 max-w-2xl">
            <ContactForm topics={TOPICS} complaintAckDays={COMPLAINT_ACK_DAYS} messageMax={CONTACT_MESSAGE_MAX} classNames={FORM_CLASSES} />
          </div>

          {brand.legalName ? (
            <p className="mt-12 text-sm text-ink-soft">
              {brand.legalName}
              {company.number ? `, no. ${company.number}` : ""}
              {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
              {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
