import type { ReactNode } from "react";

/**
 * Renders a guide paragraph. Guide copy is plain text with one allowance —
 * a `**bold**` run — so authors never write markup and the renderer never
 * has to trust any. Nothing else is interpreted.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const nodes: ReactNode[] = parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p
  );
  return <>{nodes}</>;
}
