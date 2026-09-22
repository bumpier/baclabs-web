"use client";

import { useActionState, useState } from "react";
import { stockMovementAction } from "@/app/admin/inventory/actions";
import { ADJUST_REASONS } from "@/lib/inventory/codes";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

interface Option {
  value: string;
  label: string;
}

const TYPES = [
  { value: "receive", label: "Book in", hint: "Goods arrived: add them to a location." },
  { value: "adjust", label: "Adjust", hint: "A correction, with its reason. Use a minus number to remove." },
  { value: "transfer", label: "Move", hint: "From one location to another. The total does not change." },
] as const;

export function StockMovementForm({
  skus,
  locations,
  defaultSkuId,
}: {
  skus: Option[];
  locations: Option[];
  defaultSkuId?: string;
}) {
  const [state, action] = useActionState(stockMovementAction, EMPTY_FORM_STATE);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("receive");
  const current = TYPES.find((t) => t.value === type)!;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <div role="radiogroup" aria-label="Movement type" className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              type === t.value ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-soft">{current.hint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="skuId">SKU</label>
          <select id="skuId" name="skuId" required defaultValue={defaultSkuId ?? ""} className="field">
            <option value="">Pick a SKU…</option>
            {skus.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="locationId">{type === "transfer" ? "From location" : "Location"}</label>
          <select id="locationId" name="locationId" required className="field">
            <option value="">Pick a location…</option>
            {locations.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {type === "transfer" && (
          <div>
            <label className="label" htmlFor="toLocationId">To location</label>
            <select id="toLocationId" name="toLocationId" required className="field">
              <option value="">Pick a location…</option>
              {locations.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="quantity">{type === "adjust" ? "Change (+ or −)" : "Quantity"}</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="1"
            required
            min={type === "adjust" ? undefined : 1}
            className="field tabular"
            placeholder={type === "adjust" ? "-2" : "24"}
          />
        </div>
        {type === "adjust" && (
          <>
            <div>
              <label className="label" htmlFor="reason">Reason</label>
              <select id="reason" name="reason" required className="field">
                <option value="">Pick a reason…</option>
                {ADJUST_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="note">Note</label>
              <input id="note" name="note" maxLength={200} className="field" placeholder="Required for “Other”" />
            </div>
          </>
        )}
        {type !== "transfer" && (
          <div>
            <label className="label" htmlFor="reference">Reference (optional)</label>
            <input id="reference" name="reference" maxLength={80} className="field" placeholder={type === "receive" ? "Delivery note or PO" : "Count sheet, etc."} />
          </div>
        )}
      </div>
      {type === "adjust" && (
        <p className="text-xs text-ink-soft/70">
          Splitting a pack into singles is two adjustments under &ldquo;Split pack into singles&rdquo;: −1 of the
          pack, then +N of the single.
        </p>
      )}

      <FormMessage state={state} />
      <SubmitButton className="btn-primary">{current.label}</SubmitButton>
    </form>
  );
}
