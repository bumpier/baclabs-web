import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/commerce/ContactForm";
import { brandContactTopics, CONTACT_MESSAGE_MAX } from "@/lib/commerce/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { tradingAs } from "@/lib/commerce/legal";
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
 * A plain contact page until the brand's design lands. The form posts to
 * /api/contact, which files the message under this brand (from the Host)
 * and sends it to this brand's inbox. No general reply time is promised:
 * only the operator can make that promise (ContactForm's replyTime).
 */
export default function ContactPage() {
  const inbox = brand.email.inbox;
  const company = brand.company ?? {};
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <JsonLd data={breadcrumbSchema("Contact", "/contact", brand.id)} />
      <h1 className="font-display text-4xl text-ink">Contact</h1>
      <p className="mt-3 text-ink-soft">
        Questions about an order, delivery or a return, complaints, and questions about the product before you
        order.{" "}
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

      <div className="mt-10">
        <ContactForm topics={TOPICS} complaintAckDays={COMPLAINT_ACK_DAYS} messageMax={CONTACT_MESSAGE_MAX} />
      </div>

      {brand.legalName ? (
        <p className="mt-12 text-sm text-ink-soft">
          {tradingAs(brand)}
          {company.number ? `, no. ${company.number}` : ""}
          {company.registeredAddress ? `, ${company.registeredAddress}` : ""}
          {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
        </p>
      ) : null}
    </main>
  );
}
