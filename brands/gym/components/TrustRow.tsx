import Link from "next/link";
import type { StorefrontView } from "@/lib/commerce/view";
import { TRUST } from "@/brands/gym/copy/home";
import { DispatchIcon, ReturnsIcon, SealedIcon, TrackedIcon } from "./icons";

/** "Royal Mail Tracked 48 or Amazon Shipping", from the options the catalogue offers. */
function carriers(view: StorefrontView): string {
  const names = [...new Set(view.delivery.options.map((o) => o.carrier).filter(Boolean))];
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * Four true things, on the hazard field: UK dispatch, tracked delivery (the
 * catalogue's own carriers), the sealed vial, and the returns rule the terms
 * set out. Nothing else is claimed here: no ratings, no counts, no awards.
 */
export function TrustRow({ view }: { view: StorefrontView }) {
  const via = carriers(view);
  const items = [
    { icon: DispatchIcon, title: TRUST.dispatch.title, text: TRUST.dispatch.text, link: null },
    ...(via ? [{ icon: TrackedIcon, title: TRUST.tracked.title, text: TRUST.tracked.text(via), link: null }] : []),
    { icon: SealedIcon, title: TRUST.sealed.title, text: TRUST.sealed.text, link: null },
    { icon: ReturnsIcon, title: TRUST.returns.title, text: TRUST.returns.text, link: { href: "/returns", label: TRUST.returns.link } },
  ];
  return (
    <section aria-labelledby="trust-heading" className="gym-trust">
      <div className="gym-wrap">
        <h2 id="trust-heading" className="sr-only">
          {TRUST.heading}
        </h2>
        <ul className="gym-trust-list">
          {items.map(({ icon: Icon, title, text, link }) => (
            <li key={title} className="gym-trust-item">
              <Icon className="gym-trust-icon" />
              <h3 className="gym-trust-title">{title}</h3>
              <p className="gym-trust-text">
                {text}
                {link ? (
                  <>
                    {" "}
                    <Link href={link.href} className="gym-link">
                      {link.label}
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
