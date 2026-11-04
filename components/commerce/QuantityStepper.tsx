"use client";

import { useId } from "react";

/**
 * A count between `min` and `max`: a number input with a button either side.
 * The input keeps its native keyboard behaviour (arrow keys, typing), the
 * buttons are labelled for screen readers and disabled at the bounds, and a
 * typed value is clamped on blur. The look is the caller's, slot by slot.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  classNames = {},
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** "Quantity": the input's accessible name. Visually hidden unless classNames.label shows it. */
  label: string;
  classNames?: Partial<Record<"root" | "label" | "input" | "button", string>>;
}) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const button = classNames.button ?? "btn-quiet h-11 w-11";

  return (
    <div className={classNames.root ?? "inline-flex items-center gap-2"}>
      <label htmlFor={id} className={classNames.label ?? "sr-only"}>
        {label}
      </label>
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`${label}: one fewer`}
        aria-controls={id}
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={(e) => onChange(clamp(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : min))}
        className={classNames.input ?? "field w-16 text-center"}
      />
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`${label}: one more`}
        aria-controls={id}
      >
        +
      </button>
    </div>
  );
}
