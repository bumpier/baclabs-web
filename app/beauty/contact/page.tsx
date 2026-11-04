import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { brand, TRADE_TOPIC } from "../site";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: `Message ${brand.name} about an order, delivery, a return or a question about the product.`,
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
 * enquiry form opens on their topic.
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main id="main" className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-8 pt-10 sm:px-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14 md:pt-14">
      <JsonLd data={breadcrumbSchema("Contact", "/contact", brand.id)} />
      <div>
        <h1 className="au-display text-[clamp(2.75rem,2rem+2.8vw,4.25rem)]">Contact</h1>
        <p className="au-lead mt-5">
          Questions about an order, delivery or a return, complaints, and questions about the product before you
          order.{" "}
          {inbox ? (
            <>
              Send us a message here, or email{" "}
              <a href={`mailto:${inbox}`} className="au-link text-ink">
                {inbox}
              </a>
              .
            </>
          ) : (
            "Send us a message here."
          )}
        </p>
        <p className="au-small mt-6">
          Ordering for a clinic or salon?{" "}
          <Link href="/clinics" className="au-link text-ink">
            See the clinic packs
          </Link>
          .
        </p>
        {brand.legalName ? (
          <p className="au-small mt-10">
            {brand.legalName}
            {company.number ? `, no. ${company.number}` : ""}
            {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
            {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
          </p>
        ) : null}
      </div>

      <div className="au-panel p-6 sm:p-9">
        <ContactForm
          topics={TOPICS}
          complaintAckDays={COMPLAINT_ACK_DAYS}
          messageMax={CONTACT_MESSAGE_MAX}
          classNames={{
            form: "space-y-5",
            hint: "au-small mt-2",
            note: "au-small mt-3",
            link: "au-link",
            button: "btn-cta",
            sent: "rounded-[1.5rem] bg-blush px-6 py-7",
            sentHeading: "au-h3 outline-none",
            sentText: "mt-2 text-ink-soft",
            again: "au-link mt-4 text-[0.9375rem]",
          }}
        />
      </div>
    </main>
  );
}
