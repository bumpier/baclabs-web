import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { BUNDLES, MAX_QUANTITY, PRODUCT } from "@/config/funnel";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { contentHref } from "@/lib/blog-migration";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "How to reach BacLab about an order, a return, a product question or a wholesale quote for bacteriostatic water.",
  path: "/contact",
});

/** Most vials one order on the site can hold. The wholesale path starts past it. */
const MAX_ORDER_VIALS = Math.max(...BUNDLES.map((b) => b.vials)) * MAX_QUANTITY;

/**
 * Not a form — deliberately. A contact form needs spam handling, a privacy
 * notice covering what it stores, and somewhere for the message to go. An
 * email address does the same job with none of that, and it is honest about
 * where the message actually lands.
 *
 * No response-time promise is made here: that is a commitment only the
 * operator can give, so, like every other unconfirmed fact on the site, it
 * is absent rather than guessed.
 */
export default function ContactPage() {
  const { contact, company } = brand;
  const hasEmail = Boolean(contact.email);
  const wholesaleHref = hasEmail
    ? `mailto:${contact.email}?subject=${encodeURIComponent("Wholesale enquiry: bacteriostatic water")}`
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={breadcrumbSchema("Contact", "/contact")} />
      <h1 className="text-3xl">Contact</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Questions about an order, delivery or a return, product questions before you buy, and
        wholesale enquiries.
      </p>

      {/* The page used to say "get in touch" three times while brand.contact
          .email was empty, so it told visitors to do something the site gave
          them no way to do — and the footer pointed here for the details.
          Nothing below now instructs contact unless there is a route to make
          it with. Set NEXT_PUBLIC_CONTACT_EMAIL and every one of them comes
          back on. */}
      {!hasEmail ? (
        <p className="measure mt-4 rounded-panel border border-line bg-neutral px-5 py-4 text-base text-ink">
          We are not published as reachable by email at the moment. Order
          questions are handled from the confirmation email for that order,
          and the{" "}
          <Link href="/returns" className="link">
            returns and refunds page
          </Link>{" "}
          sets out how to cancel or return without needing to reach us first.
        </p>
      ) : null}

      <dl className="mt-10 divide-y divide-line border-y border-line">
        {hasEmail ? (
          <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-ink-soft">Email</dt>
            <dd className="text-base text-ink">
              <a href={`mailto:${contact.email}`} className="link">
                {contact.email}
              </a>
            </dd>
          </div>
        ) : null}

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

      <section className="mt-12" aria-labelledby="order-heading">
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
          .{hasEmail ? " If yours is not there, get in touch." : ""} We can answer questions about
          the product as sold, a laboratory and research diluent; we cannot advise on any other use.
        </p>
      </section>

      <section id="wholesale" className="mt-10 scroll-mt-24" aria-labelledby="wholesale-heading">
        <h2 id="wholesale-heading" className="text-lg">
          Wholesale and trade
        </h2>
        <p className="measure mt-3 text-base text-ink-soft">
          The order form takes up to <span className="tabular">{MAX_ORDER_VIALS}</span> vials in one
          order.{" "}
          {hasEmail ? (
            <>
              For more than that, for a standing order, or for an institutional purchase order, get
              in touch with the quantity you need, the delivery postcode and whether it is a
              one-off or recurring, and we will reply with a quote.
            </>
          ) : (
            <>
              Pack prices, per-vial costs and the order limits are set out in full on the{" "}
              <Link href="/bulk-bacteriostatic-water" className="link">
                bulk and wholesale page
              </Link>
              .
            </>
          )}
        </p>
        {wholesaleHref ? (
          <p className="mt-4">
            <a href={wholesaleHref} className="btn-quiet sm:w-auto">
              Email a wholesale enquiry
            </a>
          </p>
        ) : null}
      </section>

      <p className="mt-12 text-sm text-ink-soft">
        <Link href="/" className="link">
          Back to the order page
        </Link>
      </p>
    </div>
  );
}
