import type { ReactNode } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { LEGAL_LAST_UPDATED, legalName, supportEmail } from "@/lib/legal";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/seo";

/**
 * Shared shell for the legal pages.
 *
 * These pages carry final wording only. There is no placeholder mechanism:
 * a fact the operator has not supplied is OMITTED, not marked up — a clause
 * that names no company number simply does not claim one, whereas a visible
 * "pending" marker reads to a customer as part of the terms. Every optional
 * fact comes from config/brand.ts and renders only when it is non-empty.
 */
export interface LegalSection {
  heading: string;
  body: ReactNode;
}

/** Slug used for the section anchor, so a clause can be linked directly. */
function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalPage({
  title,
  path,
  intro,
  sections,
}: {
  title: string;
  /** Canonical path of the page, e.g. "/returns". Feeds the breadcrumb data. */
  path: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const email = supportEmail();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <JsonLd data={breadcrumbSchema(title, path)} />
      <h1 className="text-3xl">{title}</h1>
      {intro ? <p className="measure mt-3 text-base text-ink-soft">{intro}</p> : null}
      <p className="mt-3 text-sm text-ink-soft">
        Last updated {LEGAL_LAST_UPDATED}. These terms are between you and{" "}
        {legalName()}.
      </p>

      <nav aria-label="On this page" className="mt-10 rounded-control border border-line p-5">
        <h2 className="text-sm font-semibold text-ink">On this page</h2>
        <ol className="mt-3 space-y-1.5 text-sm">
          {sections.map((s, i) => (
            <li key={s.heading} className="flex gap-2">
              <span className="tabular text-ink-soft">{i + 1}.</span>
              <a href={`#${anchor(s.heading)}`} className="link">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {sections.map((s, i) => (
          <section key={s.heading} id={anchor(s.heading)} className="scroll-mt-24 py-8">
            <h2 className="text-lg">
              <span className="tabular mr-2 text-ink-soft">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="prose-legal mt-3">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-ink-soft">
        {email ? (
          <>
            Questions about this page:{" "}
            <a href={`mailto:${email}`} className="link">
              {email}
            </a>
            {" · "}
          </>
        ) : (
          <>
            Questions about this page:{" "}
            <Link href="/contact" className="link">
              contact us
            </Link>
            {" · "}
          </>
        )}
        <Link href="/" className="link">
          Back to {brand.name}
        </Link>
      </p>
    </div>
  );
}
