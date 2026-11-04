import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { Seal } from "@/brands/luxury/components/Marks";
import { photoProps } from "@/brands/luxury/components/photo";
import { CONCIERGE } from "@/brands/luxury/copy/concierge";
import { GALLERY } from "@/brands/luxury/copy/images";
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
 * The concierge: the kit's contact form in the house's words (its `text`),
 * opening on a question about the product (`defaultTopic`), set beside the
 * seal's photograph. It posts to /api/contact, which files the message under
 * this brand (from the Host) and sends it to this brand's inbox. No reply
 * time is promised: only the operator can make that promise (ContactForm's
 * replyTime). The address and the company line appear once the profile has
 * them.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="rv-split">
      <JsonLd data={breadcrumbSchema(CONCIERGE.title, "/contact", brand.id)} />
      <figure className="rv-split__photo">
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- next/image's attributes, alt included (components/photo.ts) */}
        <img {...photoProps(GALLERY[2]!, { sizes: "(min-width: 960px) 50vw, 100vw", priority: true })} />
      </figure>

      <div className="rv-split__body">
        <Seal className="rv-legal__seal" />
        <h1 className="rv-page__heading">{CONCIERGE.heading}</h1>
        <p className="rv-page__lede">{CONCIERGE.lede}</p>
        <p className="rv-page__lede">
          {CONCIERGE.how}
          {inbox ? (
            <>
              {" "}
              {CONCIERGE.orEmail}{" "}
              <a href={`mailto:${inbox}`} className="rv-link">
                {inbox}
              </a>
              .
            </>
          ) : null}
        </p>

        <ContactForm
          topics={TOPICS}
          complaintAckDays={COMPLAINT_ACK_DAYS}
          messageMax={CONTACT_MESSAGE_MAX}
          defaultTopic={CONCIERGE.defaultTopic}
          text={CONCIERGE.form}
          classNames={{
            form: "rv-form",
            label: "rv-label",
            input: "rv-input",
            hint: "rv-hint",
            error: "rv-alert",
            button: "rv-button",
            note: "rv-form__note",
            link: "rv-link",
            sent: "rv-sent",
            sentHeading: "rv-sent__heading",
            sentText: "rv-sent__text",
            again: "rv-text-button mt-4",
          }}
        />

        {brand.legalName ? (
          <p className="rv-aside">
            {brand.legalName}
            {company.number ? `, ${CONCIERGE.companyNo} ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
            {company.vatNumber ? `, ${CONCIERGE.vat} ${company.vatNumber}` : ""}
          </p>
        ) : null}
      </div>
    </main>
  );
}
