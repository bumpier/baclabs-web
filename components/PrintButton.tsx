"use client";

/** Prints the current page. The label defaults to the packing-slip use it was built for. */
export function PrintButton({ label = "Print packing slip" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
