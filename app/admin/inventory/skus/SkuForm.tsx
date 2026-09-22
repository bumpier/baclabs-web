"use client";

import { useActionState, useState } from "react";
import { saveSkuAction } from "@/app/admin/inventory/actions";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/forms";

export interface SkuFormValues {
  id?: string;
  code: string;
  name: string;
  description: string;
  barcode: string;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  hsCode: string;
  originCountryIso: string;
  serviceCode: string;
  active: boolean;
  components: { componentSkuId: string; quantity: number }[];
}

interface Option {
  value: string;
  label: string;
}

export function SkuForm({
  values,
  services,
  componentOptions,
}: {
  values: SkuFormValues;
  services: Option[];
  /** Stocked SKUs this one could be a kit of. */
  componentOptions: Option[];
}) {
  const [state, action] = useActionState(saveSkuAction, EMPTY_FORM_STATE);
  const [rows, setRows] = useState(values.components.length > 0 ? values.components : []);
  const isNew = !values.id;

  return (
    <form action={action} className="space-y-8">
      {values.id && <input type="hidden" name="skuId" value={values.id} />}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="code">SKU code</label>
          <input
            id="code"
            name="code"
            required
            maxLength={40}
            defaultValue={values.code}
            readOnly={!isNew}
            className={`field font-mono uppercase ${isNew ? "" : "bg-brand-tint/40"}`}
            placeholder="BACLAB-10ML-X3"
          />
          <p className="mt-1.5 text-xs text-ink-soft/70">
            {isNew
              ? "Letters, numbers or both, with dashes. Fixed once saved — it goes on shelf labels."
              : "Fixed: it is on shelf labels and matched to the storefront pack codes."}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required minLength={2} maxLength={120} defaultValue={values.name} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={2} maxLength={1000} defaultValue={values.description} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="barcode">Maker&rsquo;s barcode (optional)</label>
          <input id="barcode" name="barcode" maxLength={64} defaultValue={values.barcode} className="field font-mono" placeholder="EAN / UPC" />
        </div>
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked={values.active} className="h-4 w-4 accent-[var(--color-brand)]" />
            Active
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg font-medium text-brand-deep">As it goes in the post</legend>
        <p className="mt-1 text-sm text-ink-soft">
          Weighed and measured packed, box or bag included. This is what picks the postal service, so leave
          it at 0 until it has actually been measured.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {(
            [
              ["weightGrams", "Weight (g)", values.weightGrams],
              ["lengthMm", "Length (mm)", values.lengthMm],
              ["widthMm", "Width (mm)", values.widthMm],
              ["heightMm", "Height (mm)", values.heightMm],
            ] as const
          ).map(([name, label, value]) => (
            <div key={name}>
              <label className="label" htmlFor={name}>{label}</label>
              <input id={name} name={name} type="number" min="0" step="1" defaultValue={value} className="field tabular" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="serviceCode">Postal service</label>
            <select id="serviceCode" name="serviceCode" defaultValue={values.serviceCode} className="field">
              <option value="">Automatic — worked out from weight and size</option>
              {services.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-soft/70">
              A service picked here is still checked against each order&rsquo;s parcel; if an order outgrows it,
              the automatic choice is used and the order page says why.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="hsCode">HS code</label>
              <input id="hsCode" name="hsCode" maxLength={14} defaultValue={values.hsCode} className="field font-mono" placeholder="Customs only" />
            </div>
            <div>
              <label className="label" htmlFor="originCountryIso">Made in</label>
              <input id="originCountryIso" name="originCountryIso" maxLength={2} defaultValue={values.originCountryIso} className="field uppercase" placeholder="GB" />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg font-medium text-brand-deep">Kit components</legend>
        <p className="mt-1 text-sm text-ink-soft">
          Leave empty for something that sits on a shelf with its own stock — including a pack that is already
          made up. Add components to make this a kit: selling one takes its components off the shelf, so a
          triple pack of 3 × the single takes three singles.
        </p>
        <div className="mt-4 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3">
              <input
                name="componentQty"
                type="number"
                min="1"
                step="1"
                required
                value={row.quantity}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, quantity: Number(e.target.value) } : r)))}
                className="field w-24 tabular"
                aria-label="Quantity"
              />
              <span className="text-ink-soft">×</span>
              <select
                name="componentSkuId"
                required
                value={row.componentSkuId}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, componentSkuId: e.target.value } : r)))}
                className="field min-w-[16rem] flex-1"
                aria-label="Component SKU"
              >
                <option value="">Pick a SKU…</option>
                {componentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-sm text-ink-soft hover:text-red-700">
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows([...rows, { componentSkuId: "", quantity: 1 }])}
            className="btn-secondary"
            disabled={componentOptions.length === 0}
          >
            Add component
          </button>
          {componentOptions.length === 0 && (
            <p className="text-xs text-ink-soft/70">Create the single item as a SKU first; kits are made of stocked SKUs.</p>
          )}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary">{isNew ? "Create SKU" : "Save changes"}</SubmitButton>
    </form>
  );
}
