import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { BUNDLES, MAX_QUANTITY, PRODUCT } from "@/config/funnel";
import { JsonLd } from "@/components/JsonLd";
import { ContactForm } from "@/components/contact/ContactForm";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { contentHref } from "@/lib/blog-migration";
import { CONTACT_EMAIL } from "@/lib/contact";
import { COMPLAINT_ACK_DAYS } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Message BacLab about an order, delivery, a return or a complaint, a product question or a wholesale quote for bacteriostatic water.",
  path: "/contact",
});

/** Most vials one order on the site can hold. The wholesale path starts past it. */
const MAX_ORDER_VIALS = Math.max(...BUNDLES.map((b) => b.vials)) * MAX_QUANTITY;

/**
 * The contact form, and the address for anyone who would rather email.
 * A message from the form is stored (/admin/messages) and emailed to the
 * same inbox the address reaches (lib/contact-inbox.ts), with the customer
 * as Reply-To, so both routes end in one place.
 *
 * No general response-time promise is made: that is a commitment only the
 * operator can give. The one exception is complaints, whose acknowledgement
 * time is already published in the terms (COMPLAINT_ACK_DAYS).
 */
export default function ContactPage() {
  const { company } = brand;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={breadcrumbSchema("Contact", "/contact")} />
      <h1 className="text-3xl">Contact</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Questions about an order, delivery or a return, complaints, product questions before you
        buy, and wholesale enquiries. Send us a message here, or email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="link">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <section id="contact-form" className="mt-10 scroll-mt-24" aria-labelledby="form-heading">
        <h2 id="form-heading" className="sr-only">
          Send us a message
        </h2>
        <ContactForm complaintAckDays={COMPLAINT_ACK_DAYS} />
      </section>

      {company.registeredAddress || company.legalName ? (
        <dl className="mt-14 divide-y divide-line border-y border-line">
          {company.registeredAddress ? (
            <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium text-ink-soft">Registered address</dt>
              <dd className="text-base text-ink">{company.registeredAddress}</dd>
            </div>
          ) : null}

          {company.legalName ? (
            <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium text-ink-soft">Company details</dt>
              <dd className="text-base text-ink">
                {company.legalName}
                {company.companyNumber ? `, no. ${company.companyNumber}` : ""}
                {company.vatNumber ? `, VAT ${company.vatNumber}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <section className="mt-14" aria-labelledby="order-heading">
        <h2 id="order-heading" className="text-lg">
          About an order
        </h2>
        <p className="measure mt-3 text-base text-ink-soft">
          Include the order number from your confirmation email and the name the order was placed
          under, and say what has happened: not arrived, arrived damaged, wrong quantity, or a
          return. If a vial arrived damaged, a photograph of the vial and the packaging helps. The{" "}
          <Link href="/returns" className="link">
            returns and refunds page
          </Link>{" "}
          sets out the cancellation period and how a refund is handled.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="product-heading">
        <h2 id="product-heading" className="text-lg">
          Before you order
        </h2>
        <p className="measure mt-3 text-base text-ink-soft">
          Most product questions are already answered: what {PRODUCT.name.toLowerCase()} is, how
          it differs from sterile water, how long a vial lasts once opened and how to store it are
          covered in the{" "}
          <Link href={contentHref("/guides")} className="link">
            guides
          </Link>
          , the{" "}
          <Link href="/faq" className="link">
            full FAQ
          </Link>{" "}
          and the{" "}
          <Link href="/safety-data-sheet" className="link">
            safety data sheet
          </Link>
          . If yours is not there, send us a message. We can answer questions about the product as
          sold, a laboratory and research diluent; we cannot advise on any other use.
        </p>
      </section>

      <section id="wholesale" className="mt-10 scroll-mt-24" aria-labelledby="wholesale-heading">
        <h2 id="wholesale-heading" className="text-lg">
          Wholesale and trade
        </h2>
        <p className="measure mt-3 text-base text-ink-soft">
          The order form takes up to <span className="tabular">{MAX_ORDER_VIALS}</span> vials in one
          order. For more than that, for a standing order, or for an institutional purchase order,
          send us the quantity you need, the delivery postcode and whether it is a one-off or
          recurring, and we will reply with a quote.
        </p>
        <p className="mt-4">
          {/* A full load, not a client navigation: the form reads ?topic once, on mount. */}
          <a href="/contact?topic=wholesale#contact-form" className="btn-quiet sm:w-auto">
            Send a wholesale enquiry
          </a>
        </p>
      </section>

      <p className="mt-12 text-sm text-ink-soft">
        <Link href="/" className="link">
          Back to the order page
        </Link>
      </p>
    </div>
  );
}
