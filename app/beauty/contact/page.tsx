import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { Photo } from "@/brands/beauty/components/Photo";
import { CONTACT } from "@/brands/beauty/copy/site";
import { IMAGES } from "@/brands/beauty/copy/images";
import { brand, TRADE_TOPIC } from "../site";

export const metadata: Metadata = pageMetadata({
  title: CONTACT.title,
  description: CONTACT.metaDescription(brand.name),
  path: "/contact",
  brandId: brand.id,
});

/** The topics, decided on the server (lib/contact.ts must stay out of the browser). */
const TOPICS = brandContactTopics(TRADE_TOPIC ? { trade: TRADE_TOPIC } : {});

/**
 * The contact page. The form posts to /api/contact, which files the message
 * under this brand (from the Host) and sends it to this brand's inbox. No
 * general reply time is promised: only the operator can make that promise
 * (ContactForm's replyTime). Clinics are pointed at their own page, whose
 * enquiry form opens on their topic by itself.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="au-wrap pt-8 md:pt-14">
      <JsonLd data={breadcrumbSchema(CONTACT.title, "/contact", brand.id)} />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h1 className="au-display">{CONTACT.title}</h1>
          <p className="au-lead mt-6">
            {CONTACT.lead}{" "}
            {inbox ? (
              <>
                {CONTACT.byForm}
                {CONTACT.orEmail}
                <a href={`mailto:${inbox}`} className="au-link text-ink">
                  {inbox}
                </a>
                .
              </>
            ) : (
              CONTACT.formOnly
            )}
          </p>
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="au-h3">{CONTACT.orderLead}</dt>
              <dd className="au-small mt-1.5">{CONTACT.orderHint}</dd>
            </div>
            <div>
              <dt className="au-h3">{CONTACT.clinicsLead}</dt>
              <dd className="au-small mt-1.5">
                <Link href="/clinics" className="au-link text-ink">
                  {CONTACT.clinicsLink}
                </Link>
              </dd>
            </div>
          </dl>
          <div className="au-frame mt-12 hidden aspect-[4/5] max-w-[20rem] lg:block">
            <Photo image={IMAGES.vanity} fill sizes="20rem" className="object-[30%_18%]" alt="" />
          </div>
          {brand.legalName ? (
            <p className="au-fine mt-10">
              {brand.legalName}
              {company.number ? `, no. ${company.number}` : ""}
              {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
              {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
            </p>
          ) : null}
        </div>

        <div className="au-panel self-start p-6 sm:p-10">
          <ContactForm
            topics={TOPICS}
            text={CONTACT.form}
            complaintAckDays={COMPLAINT_ACK_DAYS}
            messageMax={CONTACT_MESSAGE_MAX}
            classNames={{
              form: "space-y-5",
              hint: "au-small mt-2",
              note: "au-fine mt-3",
              link: "au-link",
              button: "btn-cta",
              sent: "rounded-[1.5rem] bg-blush px-6 py-7",
              sentHeading: "au-h3 outline-none",
              sentText: "mt-2 text-ink-soft",
              again: "au-link mt-4 text-[0.9375rem]",
            }}
          />
        </div>
      </div>
    </main>
  );
}
