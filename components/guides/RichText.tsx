import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders a guide paragraph. Guide copy is plain text with two allowances —
 * a `**bold**` run and a `[label](/path)` link — so authors never write
 * markup and the renderer never has to trust any. Nothing else is
 * interpreted.
 *
 * Links are SITE-INTERNAL ONLY. A href that is not a root-relative path is
 * rendered as its literal source text rather than linked, so `javascript:`,
 * `//evil.example` and any absolute URL are inert by construction. This
 * matters because guide copy now comes from the database and is editable
 * from /admin: the safe set is decided here, not by whoever is typing.
 *
 * Guides must not link out anyway — AUTHORING.md rule 4 forbids naming
 * competitors — so internal-only costs authors nothing they are allowed to do.
 */
const TOKEN = /\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Root-relative paths only. `//host` is protocol-relative, so it is not one. */
function isInternalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function RichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  // A fresh regex per call: TOKEN is module-level and stateful with /g.
  const token = new RegExp(TOKEN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = token.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    const [raw, boldRun, linkLabel, linkHref] = match;

    if (boldRun !== undefined) {
      nodes.push(<strong key={match.index}>{boldRun}</strong>);
    } else if (linkHref !== undefined && isInternalPath(linkHref)) {
      nodes.push(
        <Link key={match.index} href={linkHref}>
          {linkLabel}
        </Link>
      );
    } else {
      // Not a path we will link. Show the author exactly what they wrote so
      // the mistake is visible on the page rather than silently swallowed.
      nodes.push(raw);
    }

    cursor = match.index + raw.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
