import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CONTACT } from "@/brands/wholesale/copy/pages";
import { FORM_CLASSES } from "@/brands/wholesale/components/form-classes";
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
 * quote page is the same form with that topic alone.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="wh-wrap">
      <JsonLd data={breadcrumbSchema(CONTACT.title, "/contact", brand.id)} />
      <div className="wh-page-head">
        <h1 className="wh-page-title">{CONTACT.title}</h1>
        <p className="wh-page-lede">
          {CONTACT.lede}{" "}
          {inbox ? (
            <>
              Send us a message here, or email{" "}
              <a href={`mailto:${inbox}`} className="link">
                {inbox}
              </a>
              .
            </>
          ) : (
            "Send us a message here."
          )}
        </p>
        <p className="wh-page-lede mt-3">
          {CONTACT.quoteAside}{" "}
          <Link href="/quote" className="link font-semibold text-navy">
            {CONTACT.quoteLink}
          </Link>
          .
        </p>
      </div>

      <div className="grid max-w-3xl gap-6 pb-14 md:pb-20">
        <section aria-labelledby="form-heading" className="wh-sheet">
          <h2 id="form-heading" className="wh-sheet-head">
            {CONTACT.formHeading}
          </h2>
          <div className="wh-sheet-body">
            <ContactForm
              topics={TOPICS}
              complaintAckDays={COMPLAINT_ACK_DAYS}
              messageMax={CONTACT_MESSAGE_MAX}
              classNames={FORM_CLASSES}
            />
          </div>
        </section>
        {brand.legalName ? (
          <p className="text-sm text-ink-soft">
            {brand.legalName}
            {company.number ? `, no. ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
            {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
          </p>
        ) : null}
      </div>
    </main>
  );
}
