import Link from "next/link";
import { brand } from "@/config/brand";
import { contentHref } from "@/lib/blog-migration";
import { PRODUCT, formatMinor } from "@/config/funnel";

/**
 * Legal and support links. These URLs are stable — do not rename them; the
 * privacy path in particular predates the funnel and may already be linked
 * from elsewhere.
 */
export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/returns", label: "Returns & refunds" },
  { href: "/disclaimer", label: "Product disclaimer" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Commercial pages that are not the product page itself. Read by the sitemap
 * and llms.txt alongside LEARN_LINKS, so adding a page here publishes it in
 * the navigation, the sitemap and the machine-readable index at once.
 */
export const SHOP_LINKS = [
  { href: "/bulk-bacteriostatic-water", label: "Bulk & wholesale" },
  { href: "/quality-and-documentation", label: "Quality & documentation" },
] as const;

/**
 * The guide hub and its reference pages. Read by the sitemap and llms.txt as
 * well as rendered here, so a page cannot be listed in one and not the other.
 */
export const LEARN_LINKS = [
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "All questions" },
  { href: "/calculator", label: "Dilution calculator" },
  { href: "/safety-data-sheet", label: "Safety data sheet" },
] as const;

export function Footer() {
  const { company, contact, disclaimer, trust } = brand;
  const year = new Date().getFullYear();
  const hasEmail = Boolean(contact.email);

  return (
    <footer className="no-print mt-auto bg-abyss text-white/70">
      <div className="shell-wide py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Identity and the product line, so the footer restates what is
              sold rather than being purely navigational. */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt="" width={30} height={30} className="h-[30px] w-[30px]" />
              <span className="font-display text-xl font-bold tracking-tight text-white">
                {brand.name}
              </span>
            </div>
            <p className="measure mt-4 text-base text-white/60">
              {PRODUCT.name}, {PRODUCT.size}. {PRODUCT.composition}
            </p>
            <p className="mt-5">
              <a href="/#buy" className="btn-onDark">
                Choose your pack &mdash; from {formatMinor(PRODUCT.unitPriceMinor)}
              </a>
            </p>
          </div>

          <nav aria-label="Buying" className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Buying</h2>
            <ul className="mt-4 space-y-2.5">
              {SHOP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/65 underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-white hover:decoration-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Guides and reference" className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Learn</h2>
            <ul className="mt-4 space-y-2.5">
              {LEARN_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={contentHref(l.href)}
                    className="text-sm text-white/65 underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-white hover:decoration-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal and support" className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Policies</h2>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/65 underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-white hover:decoration-white/60"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Support</h2>
            {hasEmail ? (
              <p className="mt-4 text-sm">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-white/65 underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-white"
                >
                  {contact.email}
                </a>
              </p>
            ) : (
              <p className="mt-4 text-sm text-white/50">
                Contact details are on the{" "}
                <Link
                  href="/contact"
                  className="text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white"
                >
                  contact page
                </Link>
                .
              </p>
            )}
            <p className="mt-4 text-sm text-white/50">Payments processed securely by Stripe.</p>
            {trust.qualityLine ? (
              <p className="mt-2 text-sm">
                <Link
                  href="/#guarantee"
                  className="text-white/65 underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-white"
                >
                  {trust.qualityLine}
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        {/* The compliance line renders only when config/brand.ts supplies it.
            Empty by default — the wording is a legal decision. */}
        {disclaimer ? (
          <p className="measure mt-14 border-l-2 border-white/20 pl-4 text-sm text-white/60">
            {disclaimer}
          </p>
        ) : null}

        {/* Every company detail is optional and renders only when set, so an
            unfilled field is invisible rather than a visible placeholder. */}
        <div className="mt-12 border-t border-white/10 pt-8 text-xs text-white/50">
          <p>
            © {year} {company.legalName || brand.name}. All rights reserved.
          </p>
          {company.companyNumber ? (
            <p className="mt-1">Registered in England &amp; Wales no. {company.companyNumber}</p>
          ) : null}
          {company.registeredAddress ? <p className="mt-1">{company.registeredAddress}</p> : null}
          {company.vatNumber ? <p className="mt-1 tabular">VAT no. {company.vatNumber}</p> : null}
        </div>
      </div>
    </footer>
  );
}
