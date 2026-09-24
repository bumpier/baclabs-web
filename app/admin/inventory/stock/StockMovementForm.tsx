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
  vialSkuId,
  supplierPackVials,
}: {
  skus: Option[];
  locations: Option[];
  defaultSkuId?: string;
  /** The single vial's SKU, which arrives from the supplier in packs. */
  vialSkuId?: string;
  supplierPackVials: number;
}) {
  const [state, action] = useActionState(stockMovementAction, EMPTY_FORM_STATE);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("receive");
  const current = TYPES.find((t) => t.value === type)!;
  const [skuId, setSkuId] = useState(defaultSkuId ?? "");
  // Stock is counted in vials; deliveries are counted in the supplier's packs.
  const [unit, setUnit] = useState<"vial" | "supplierPack">("supplierPack");
  const [quantity, setQuantity] = useState("");
  const byPack = type === "receive" && !!vialSkuId && skuId === vialSkuId && unit === "supplierPack";
  const packs = Number(quantity);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="unit" value={byPack ? "supplierPack" : "vial"} />
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
          <select id="skuId" name="skuId" required value={skuId} onChange={(e) => setSkuId(e.target.value)} className="field">
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
        {type === "receive" && vialSkuId && skuId === vialSkuId && (
          <div className="sm:col-span-2">
            <span className="label">Count in</span>
            <div role="radiogroup" aria-label="Count in" className="flex flex-wrap gap-2">
              {(
                [
                  ["supplierPack", `Supplier packs of ${supplierPackVials}`],
                  ["vial", "Single vials"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={unit === value}
                  onClick={() => setUnit(value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    unit === value ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="quantity">
            {type === "adjust" ? "Change (+ or −)" : byPack ? "Packs received" : "Quantity"}
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="1"
            required
            min={type === "adjust" ? undefined : 1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="field tabular"
            placeholder={type === "adjust" ? "-2" : byPack ? "100" : "24"}
          />
          {byPack && Number.isInteger(packs) && packs > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              = <span className="tabular font-semibold text-ink">{(packs * supplierPackVials).toLocaleString("en-GB")}</span> vials
            </p>
          )}
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
