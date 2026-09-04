import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to get in touch.",
  alternates: { canonical: "/contact" },
};

/**
 * Not a form — deliberately. A contact form needs spam handling, a privacy
 * notice covering what it stores, and somewhere for the message to go. An
 * email address does the same job with none of that, and it is honest about
 * where the message actually lands.
 */
export default function ContactPage() {
  const { contact, company } = brand;
  const hasEmail = Boolean(contact.email);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="text-3xl">Contact</h1>
      <p className="measure mt-3 text-base text-ink-soft">
        Questions about an order, delivery or a return.
      </p>

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

      <p className="mt-10 text-sm text-ink-soft">
        <Link href="/" className="link">
          Back to the order page
        </Link>
      </p>
    </div>
  );
}
