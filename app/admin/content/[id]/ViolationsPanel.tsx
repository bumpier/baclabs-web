"use client";

import type { Violation } from "@/lib/content-rules";

/**
 * What currently blocks publishing. Always visible, including when empty, so
 * "no violations" is a state the author can see rather than infer.
 */
export function ViolationsPanel({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) {
    return (
      <div className="rounded-panel border border-green-300 bg-green-50 p-4 text-sm text-green-900">
        No rule violations. This can be published.
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">
        {violations.length} thing{violations.length === 1 ? "" : "s"} must change before this can be
        published
      </p>
      <ul className="mt-2 grid gap-1">
        {violations.map((v, i) => (
          <li key={i}>
            <span className="font-medium">{v.field}</span>: {v.why}
            {v.match ? <span className="text-red-700"> ({v.match})</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-red-800">
        Saving a draft always works. These rules are checked again on the server when you publish.
      </p>
    </div>
  );
}
