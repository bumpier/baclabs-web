import { saleLabel } from "@/config/funnel";

/**
 * The sale badge: solid brand blue with white text (6.28:1, AA), the same
 * blue as the buy buttons. One component so every surface shows the sale
 * the same way.
 *
 * It renders unconditionally — callers decide whether the sale is showing
 * with saleVisible(), exactly as they do for the struck-through price beside
 * it. No hooks, so server and client components can both use it.
 *
 * `normal-case tracking-normal` because it sits inside uppercase eyebrow
 * lines on the pack pages, and a badge should read the same everywhere.
 */
export function SaleTag({
  label = saleLabel(),
  size = "sm",
}: {
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-control bg-brand font-semibold normal-case leading-tight tracking-normal text-white",
        size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
