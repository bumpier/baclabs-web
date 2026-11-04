import Link from "next/link";
import { Fragment } from "react";
import type { LegalBlock, LegalDoc, LegalIdentity, LegalInline } from "@/lib/commerce/legal-doc";

type Slot = "root" | "title" | "intro" | "meta" | "toc" | "tocHeading" | "tocList" | "sections" | "section" | "heading" | "body" | "foot" | "link";

/**
 * A brand's legal page: its title, the party line, a table of contents and
 * the numbered sections of a LegalDoc (lib/commerce/legal.ts). The brand-
 * neutral twin of components/LegalPage.tsx, which reads BacLab's
 * config/brand.ts: everything about who "we" are is the `identity` prop.
 *
 * A server component (it can render in a client tree too). The JSON-LD
 * breadcrumb is the page's: it needs the brand's origin, which this file
 * must not import. Every element takes a class; `.legal-prose` (the shared
 * class contract) spaces the clause text.
 */
export function LegalPage({
  identity,
  doc,
  classNames = {},
}: {
  identity: LegalIdentity;
  doc: LegalDoc;
  classNames?: Partial<Record<Slot, string>>;
}) {
  const c = (slot: Slot, fallback: string) => classNames[slot] ?? fallback;
  const link = c("link", "link");

  return (
    <article className={c("root", "")}>
      <h1 className={c("title", "text-3xl")}>{doc.title}</h1>
      {doc.intro ? <p className={c("intro", "mt-3")}>{doc.intro}</p> : null}
      <p className={c("meta", "mt-3 text-sm")}>
        Last updated {doc.lastUpdated}. These terms are between you and {identity.party}.
      </p>

      <nav aria-label="On this page" className={c("toc", "commerce-panel mt-10 p-5")}>
        <h2 className={c("tocHeading", "text-sm font-semibold")}>On this page</h2>
        <ol className={c("tocList", "mt-3 list-decimal space-y-1.5 pl-5 text-sm")}>
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={link}>
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={c("sections", "mt-10")}>
        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className={c("section", "scroll-mt-24 py-8")}>
            <h2 id={`${s.id}-heading`} className={c("heading", "text-lg font-semibold")}>
              <span className="mr-2">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className={c("body", "legal-prose mt-3")}>
              {s.blocks.map((b, j) => (
                <Block key={j} block={b} linkClass={link} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className={c("foot", "mt-10 text-sm")}>
        Questions about this page:{" "}
        {identity.contactEmail ? (
          <a href={`mailto:${identity.contactEmail}`} className={link}>
            {identity.contactEmail}
          </a>
        ) : (
          <Link href="/contact" className={link}>
            contact us
          </Link>
        )}
        {" · "}
        <Link href="/" className={link}>
          Back to {identity.name}
        </Link>
      </p>
    </article>
  );
}

function Block({ block, linkClass }: { block: LegalBlock; linkClass: string }) {
  switch (block.kind) {
    case "p":
      return (
        <p>
          <Inline runs={block.content} linkClass={linkClass} />
        </p>
      );
    case "h3":
      return <h3>{block.text}</h3>;
    case "ul":
    case "ol": {
      const List = block.kind;
      return (
        <List>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline runs={item} linkClass={linkClass} />
            </li>
          ))}
        </List>
      );
    }
    case "dl":
      return (
        <dl>
          {block.items.map((item) => (
            <Fragment key={item.term}>
              <dt>{item.term}</dt>
              <dd>
                <Inline runs={item.detail} linkClass={linkClass} />
              </dd>
            </Fragment>
          ))}
        </dl>
      );
  }
}

function Inline({ runs, linkClass }: { runs: LegalInline[]; linkClass: string }) {
  return (
    <>
      {runs.map((r, i) => {
        if (typeof r === "string") return <Fragment key={i}>{r}</Fragment>;
        if ("strong" in r) return <strong key={i}>{r.strong}</strong>;
        // Site paths go through the router; mailto: and other sites do not.
        if (r.href.startsWith("/")) {
          return (
            <Link key={i} href={r.href} className={linkClass}>
              {r.text}
            </Link>
          );
        }
        const external = r.href.startsWith("http");
        return (
          <a
            key={i}
            href={r.href}
            className={linkClass}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {r.text}
          </a>
        );
      })}
    </>
  );
}
