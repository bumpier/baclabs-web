import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { CONCIERGE } from "@/brands/luxury/copy/concierge";
import { brand, TRADE_TOPIC } from "../site";

export const metadata: Metadata = pageMetadata({
  title: CONCIERGE.title,
  description: CONCIERGE.description(brand.name),
  path: "/contact",
  brandId: brand.id,
});

/** The topics, decided on the server (lib/contact.ts must stay out of the browser). */
const TOPICS = brandContactTopics(TRADE_TOPIC ? { trade: TRADE_TOPIC } : {});

/**
 * The concierge: the kit's contact form in the brand's dress. It posts to
 * /api/contact, which files the message under this brand (from the Host)
 * and sends it to this brand's inbox. No reply time is promised: only the
 * operator can make that promise (ContactForm's replyTime). The address and
 * the company line appear once the profile has them.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="rx-wrap rx-page">
      <JsonLd data={breadcrumbSchema(CONCIERGE.title, "/contact", brand.id)} />
      <div className="rx-concierge">
        <div>
          <h1 className="rx-page__heading">{CONCIERGE.heading}</h1>
          <p className="rx-page__lede">{CONCIERGE.lede}</p>
          <p className="rx-page__lede">
            {CONCIERGE.how}
            {inbox ? (
              <>
                {" "}
                {CONCIERGE.orEmail}{" "}
                <a href={`mailto:${inbox}`} className="rx-link">
                  {inbox}
                </a>
                .
              </>
            ) : null}
          </p>
          {brand.legalName ? (
            <p className="rx-concierge__aside">
              {brand.legalName}
              {company.number ? `, ${CONCIERGE.companyNo} ${company.number}` : ""}
              {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
              {company.vatNumber ? `, ${CONCIERGE.vat} ${company.vatNumber}` : ""}
            </p>
          ) : null}
        </div>

        <ContactForm
          topics={TOPICS}
          complaintAckDays={COMPLAINT_ACK_DAYS}
          messageMax={CONTACT_MESSAGE_MAX}
          classNames={{
            form: "rx-form",
            label: "rx-label",
            input: "rx-input",
            hint: "rx-hint",
            button: "rx-btn",
            note: "rx-form__note",
            link: "rx-link",
            sent: "rx-sent rx-frame rx-frame--ivory",
            sentHeading: "rx-sent__heading",
            sentText: "rx-sent__text",
            again: "rx-link mt-5 text-sm",
          }}
        />
      </div>
    </main>
  );
}
