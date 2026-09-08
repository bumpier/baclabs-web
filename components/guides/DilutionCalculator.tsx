"use client";

import { useId, useState } from "react";

/**
 * Concentration arithmetic for reconstituting a solid with a diluent. Two
 * directions: contents and volume added give a concentration; contents and a
 * target concentration give the volume to add. Everything is client-side and
 * nothing is stored.
 *
 * The words are deliberate. A vial holds a "substance"; the liquid is a
 * "diluent"; an amount withdrawn is an "aliquot". This is a laboratory
 * calculator, and it never suggests what any figure should be.
 */

type Direction = "concentration" | "volume";

function fmt(n: number, dp = 3): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("en-GB", { maximumFractionDigits: dp });
}

const PRESET_MG = [1, 2, 5, 10, 50];
const PRESET_ML = [0.5, 1, 2, 3, 5];

export function DilutionCalculator() {
  const [direction, setDirection] = useState<Direction>("concentration");
  const [mg, setMg] = useState("5");
  const [ml, setMl] = useState("2");
  const [target, setTarget] = useState("2.5");
  const [aliquot, setAliquot] = useState("0.1");
  const id = useId();

  const mgN = parseFloat(mg);
  const mlN = parseFloat(ml);
  const targetN = parseFloat(target);
  const aliquotN = parseFloat(aliquot);

  const concentration = direction === "concentration" ? mgN / mlN : targetN;
  const volumeToAdd = direction === "volume" ? mgN / targetN : mlN;
  const valid =
    mgN > 0 &&
    (direction === "concentration" ? mlN > 0 : targetN > 0) &&
    Number.isFinite(concentration) &&
    Number.isFinite(volumeToAdd);

  const perAliquotMg = valid && aliquotN > 0 ? concentration * aliquotN : NaN;
  const aliquotsPerVial = valid && aliquotN > 0 ? Math.floor(volumeToAdd / aliquotN) : NaN;

  const field =
    "mt-1 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base text-ink tabular focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
  const label = "block text-sm font-medium text-ink";
  const preset =
    "rounded-control border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-brand/40 hover:text-ink";

  return (
    <div className="surface-card p-6 sm:p-8">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What do you want to find?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["concentration", "Concentration, from the volume added"],
              ["volume", "Volume to add, for a target concentration"],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={[
                "cursor-pointer rounded-control border px-3 py-2 text-sm",
                direction === value ? "border-brand bg-brand-tint text-ink" : "border-line text-ink-soft",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`${id}-direction`}
                value={value}
                checked={direction === value}
                onChange={() => setDirection(value)}
                className="sr-only"
              />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-mg`} className={label}>
            Substance in the vial (mg)
          </label>
          <input
            id={`${id}-mg`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={mg}
            onChange={(e) => setMg(e.target.value)}
            className={field}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_MG.map((v) => (
              <button key={v} type="button" onClick={() => setMg(String(v))} className={preset}>
                {v} mg
              </button>
            ))}
          </div>
        </div>

        {direction === "concentration" ? (
          <div>
            <label htmlFor={`${id}-ml`} className={label}>
              Diluent added (mL)
            </label>
            <input
              id={`${id}-ml`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={ml}
              onChange={(e) => setMl(e.target.value)}
              className={field}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_ML.map((v) => (
                <button key={v} type="button" onClick={() => setMl(String(v))} className={preset}>
                  {v} mL
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor={`${id}-target`} className={label}>
              Target concentration (mg/mL)
            </label>
            <input
              id={`${id}-target`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={field}
            />
          </div>
        )}

        <div>
          <label htmlFor={`${id}-aliquot`} className={label}>
            Aliquot volume (mL), optional
          </label>
          <input
            id={`${id}-aliquot`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={aliquot}
            onChange={(e) => setAliquot(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-xs text-ink-soft">The volume withdrawn each time, to see what each aliquot contains.</p>
        </div>
      </div>

      <div className="mt-8 rounded-panel border border-brand/25 bg-brand-tint p-5" aria-live="polite">
        {valid ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {direction === "concentration" ? "Concentration" : "Volume of diluent to add"}
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold text-ink">
                {direction === "concentration" ? (
                  <>
                    {fmt(concentration)} <span className="text-base font-medium text-ink-soft">mg/mL</span>
                  </>
                ) : (
                  <>
                    {fmt(volumeToAdd)} <span className="text-base font-medium text-ink-soft">mL</span>
                  </>
                )}
              </dd>
              <dd className="mt-1 text-sm text-ink-soft">
                {direction === "concentration"
                  ? `${fmt(concentration * 1000, 1)} µg/mL`
                  : `giving ${fmt(concentration)} mg/mL`}
              </dd>
            </div>
            {aliquotN > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Each {fmt(aliquotN)} mL aliquot contains
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold text-ink">
                  {fmt(perAliquotMg)} <span className="text-base font-medium text-ink-soft">mg</span>
                </dd>
                <dd className="mt-1 text-sm text-ink-soft">
                  {fmt(perAliquotMg * 1000, 1)} µg; about {fmt(aliquotsPerVial, 0)} aliquots from{" "}
                  {fmt(volumeToAdd)} mL
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-ink-soft">Enter a mass and a volume greater than zero.</p>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        Arithmetic only: concentration = mass ÷ volume. It assumes the substance dissolves fully and
        adds no volume of its own. What any figure should be is a matter for your own laboratory
        protocol.
      </p>
    </div>
  );
}
