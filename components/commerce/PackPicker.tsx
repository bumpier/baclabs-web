"use client";

import { useId, type ReactNode } from "react";
import type { PackView } from "@/lib/commerce/view";

/**
 * Choosing one pack: a radio group made of native radio inputs, so arrow
 * keys, the form's validation and every screen reader work without help.
 * A quote-only pack (available: false) is shown but cannot be chosen.
 *
 * It decides nothing about the look. `renderPack` draws each choice from
 * its pack and state (the input itself is visually hidden but focusable;
 * style the label with `:has(:focus-visible)` or the state given), and
 * every element takes a class.
 */
export function PackPicker({
  packs,
  value,
  onChange,
  legend,
  name,
  renderPack,
  classNames = {},
}: {
  packs: readonly PackView[];
  /** The chosen pack's SKU, or null for none yet. */
  value: string | null;
  onChange: (sku: string) => void;
  /** The group's name for assistive technology, e.g. "Pack size". Visually hidden unless classNames.legend shows it. */
  legend: string;
  name?: string;
  renderPack: (pack: PackView, state: { checked: boolean; disabled: boolean }) => ReactNode;
  classNames?: Partial<Record<"fieldset" | "legend" | "list" | "option", string>>;
}) {
  const auto = useId();
  const group = name ?? `pack-${auto}`;

  return (
    <fieldset className={classNames.fieldset ?? ""}>
      <legend className={classNames.legend ?? "sr-only"}>{legend}</legend>
      <div className={classNames.list ?? "grid gap-3"}>
        {packs.map((pack) => {
          const checked = value === pack.sku;
          const disabled = !pack.available;
          return (
            <label key={pack.sku} className={classNames.option ?? "commerce-option"} data-checked={checked || undefined} data-disabled={disabled || undefined}>
              <input
                type="radio"
                name={group}
                value={pack.sku}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(pack.sku)}
                className="sr-only"
              />
              {renderPack(pack, { checked, disabled })}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
