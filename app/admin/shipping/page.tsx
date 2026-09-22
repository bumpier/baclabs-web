import Link from "next/link";
import type { PostalService } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { ActionForm } from "@/components/admin/ActionForm";
import { smartTrackConfig, smartTrackEnv } from "@/lib/smarttrack/config";
import { formatWeight } from "@/lib/shipping/parcel";
import { toServiceRule } from "@/lib/shipping/select-service";
import { getDeliveryInstructions } from "@/lib/shipping/shipments";
import { LIMITS } from "@/lib/smarttrack/payload";
import {
  saveDeliveryInstructionsAction,
  saveServiceAction,
  syncServicesAction,
  testConnectionAction,
} from "@/app/admin/shipping/actions";

export const dynamic = "force-dynamic";

function limitsSummary(s: PostalService): string {
  const parts: string[] = [];
  const band =
    s.maxWeightGrams > 0
      ? `${s.minWeightGrams > 0 ? `${formatWeight(s.minWeightGrams)}–` : "up to "}${formatWeight(s.maxWeightGrams)}`
      : s.minWeightGrams > 0
        ? `from ${formatWeight(s.minWeightGrams)}`
        : "any weight";
  parts.push(band);
  const sides = [s.maxLengthMm, s.maxWidthMm, s.maxHeightMm];
  if (sides.some((n) => n > 0)) parts.push(`${sides.map((n) => (n > 0 ? n : "any")).join(" × ")} mm`);
  if (s.sizeFormula && s.sizeLimitMm > 0) parts.push(`${s.sizeFormula} ≤ ${s.sizeLimitMm} mm`);
  if (s.volumetricDivisor) parts.push(`volumetric ÷${s.volumetricDivisor}`);
  return parts.join(" · ");
}

function ServiceFields({ s }: { s?: PostalService }) {
  const manual = !s || s.source === "MANUAL";
  const countries = s ? toServiceRule(s).deliveryCountryIsos.join(", ") : "GB";
  const num = (name: keyof PostalService, label: string, value: number | null | undefined) => (
    <div>
      <label className="label" htmlFor={`${s?.id ?? "new"}-${name}`}>{label}</label>
      <input id={`${s?.id ?? "new"}-${name}`} name={name} type="number" min="0" step="1" defaultValue={value ?? ""} className="field tabular" />
    </div>
  );
  return (
    <div className="space-y-4">
      {manual && (
        <div className="grid gap-4 sm:grid-cols-3">
          {!s && (
            <div>
              <label className="label" htmlFor="new-code">Service code</label>
              <input id="new-code" name="code" required maxLength={40} className="field font-mono uppercase" placeholder="As SmartTrack names it" />
            </div>
          )}
          <div>
            <label className="label" htmlFor={`${s?.id ?? "new"}-name`}>Name</label>
            <input id={`${s?.id ?? "new"}-name`} name="name" required maxLength={80} defaultValue={s?.name} className="field" />
          </div>
          <div>
            <label className="label" htmlFor={`${s?.id ?? "new"}-carrier`}>Carrier</label>
            <input id={`${s?.id ?? "new"}-carrier`} name="carrier" maxLength={40} defaultValue={s?.carrier} className="field" />
          </div>
          {num("minWeightGrams", "Min weight (g)", s?.minWeightGrams ?? 0)}
          {num("maxWeightGrams", "Max weight (g), 0 = none", s?.maxWeightGrams ?? 0)}
          {num("maxLengthMm", "Max length (mm)", s?.maxLengthMm ?? 0)}
          {num("maxWidthMm", "Max width (mm)", s?.maxWidthMm ?? 0)}
          {num("maxHeightMm", "Max height (mm)", s?.maxHeightMm ?? 0)}
          <div>
            <label className="label" htmlFor={`${s?.id ?? "new"}-sizeFormula`}>Size rule</label>
            <input id={`${s?.id ?? "new"}-sizeFormula`} name="sizeFormula" maxLength={40} defaultValue={s?.sizeFormula} className="field font-mono" placeholder="L+W+H or L+2W+2H" />
          </div>
          {num("sizeLimitMm", "Size rule limit (mm)", s?.sizeLimitMm ?? 0)}
          <div>
            <label className="label" htmlFor={`${s?.id ?? "new"}-countries`}>Delivers to</label>
            <input id={`${s?.id ?? "new"}-countries`} name="countries" defaultValue={countries} className="field uppercase" placeholder="GB — blank for anywhere" />
          </div>
          <div className="flex items-end pb-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="tracked" defaultChecked={s ? s.tracked : true} className="h-4 w-4 accent-[var(--color-brand)]" />
              Tracked
            </label>
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor={`${s?.id ?? "new"}-description`}>Notes</label>
            <input id={`${s?.id ?? "new"}-description`} name="description" maxLength={300} defaultValue={s?.description} className="field" />
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {num("priority", "Priority (lower is preferred)", s?.priority ?? 100)}
        {num("volumetricDivisor", "Volumetric divisor (blank = none)", s?.volumetricDivisor)}
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked={s ? s.active : true} className="h-4 w-4 accent-[var(--color-brand)]" />
            Switched on
          </label>
        </div>
      </div>
    </div>
  );
}

export default async function ShippingPage() {
  await requireAdminRole("ADMIN");
  const cfg = smartTrackConfig();
  const env = smartTrackEnv();
  const [services, deliveryInstructions] = await Promise.all([
    prisma.postalService.findMany({ orderBy: [{ active: "desc" }, { priority: "asc" }, { name: "asc" }] }),
    getDeliveryInstructions(),
  ]);
  const lastSync = services.map((s) => s.syncedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Postage</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">Shipping</h1>

      {/* ── Connection ── */}
      <section className="card mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="label">SmartTrack</p>
            {cfg ? (
              <>
                <p className="text-lg font-semibold text-brand-deep">
                  Key set · {cfg.env === "live" ? "LIVE — labels are real postage" : "UAT — test labels only"}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Labels are {cfg.labelSize} mm PDFs. {lastSync ? `Services last synced ${lastSync.toLocaleString("en-GB")}.` : "Services not synced yet."}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-amber-700">Not connected</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
                  <li>Get a SmartTrack account (UAT for testing, at qa.smarttrack.co, and live).</li>
                  <li>Log in → Profile → API Keys, and copy the API Key and API Secret.</li>
                  <li>
                    Set <code className="font-mono">SMARTTRACK_API_KEY</code>, <code className="font-mono">SMARTTRACK_API_SECRET</code>{" "}
                    and <code className="font-mono">SMARTTRACK_ENV</code> ({env === "live" ? "currently live" : "uat until you go live"}) in the
                    server&rsquo;s env file, then restart.
                  </li>
                  <li>Come back here and sync the services on the account.</li>
                </ol>
                <p className="mt-3 text-sm text-ink-soft">
                  Until then, services can be added by hand below so SKUs and orders can be checked against them.
                </p>
              </>
            )}
          </div>
          {cfg && (
            <div className="flex flex-wrap gap-3">
              <ActionForm action={testConnectionAction} submitLabel="Test connection" submitClassName="btn-secondary" className="space-y-2" />
              <ActionForm action={syncServicesAction} submitLabel="Sync services" className="space-y-2" />
            </div>
          )}
        </div>
      </section>

      {/* ── Delivery instructions ── */}
      <section className="card mt-4 p-6">
        <ActionForm
          action={saveDeliveryInstructionsAction}
          submitLabel="Save"
          submitClassName="btn-secondary"
          className="flex flex-wrap items-end gap-4"
        >
          <div className="min-w-[16rem] flex-1">
            <label className="label" htmlFor="deliveryInstructions">Delivery instructions on every label</label>
            <input
              id="deliveryInstructions"
              name="deliveryInstructions"
              required
              maxLength={LIMITS.description}
              defaultValue={deliveryInstructions}
              className="field"
            />
            <p className="mt-1.5 text-xs text-ink-soft/70">
              Sent to the carrier in SmartTrack&rsquo;s description field, up to {LIMITS.description} characters.
            </p>
          </div>
        </ActionForm>
      </section>

      {/* ── Services ── */}
      <h2 className="mt-12 font-display text-xl font-medium text-brand-deep">Postal services</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Every order&rsquo;s parcel is checked against these. The first that fits, by priority, is suggested —
        unless the SKU has a service of its own that fits. A synced service&rsquo;s limits come from SmartTrack;
        only its priority, volumetric divisor and on/off are yours to change.
      </p>
      {services.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-soft">No services yet.</p>
      ) : (
        <div className="card mt-4 divide-y divide-line">
          {services.map((s) => (
            <details key={s.id} className="group px-5 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className={`w-28 font-mono text-xs font-semibold ${s.active ? "text-brand-deep" : "text-ink-soft line-through"}`}>{s.code}</span>
                <span className="min-w-[10rem] flex-1 font-medium">{s.name}</span>
                <span className="text-ink-soft">{limitsSummary(s)}</span>
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs text-brand-deep">
                  {s.source === "SMARTTRACK" ? "SmartTrack" : "manual"}
                </span>
                <span className="w-20 text-right text-xs text-ink-soft tabular">priority {s.priority}</span>
              </summary>
              <div className="mt-4">
                <ActionForm action={saveServiceAction} submitLabel="Save service">
                  <input type="hidden" name="serviceId" value={s.id} />
                  <ServiceFields s={s} />
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
      )}

      <section className="card mt-8 p-6">
        <h2 className="font-display text-lg font-medium text-brand-deep">Add a service by hand</h2>
        <p className="mt-1 text-sm text-ink-soft">
          For testing before the account is connected, or a service SmartTrack does not list. Use the exact
          service code SmartTrack uses, or labels for it will be refused.
        </p>
        <div className="mt-4">
          <ActionForm action={saveServiceAction} submitLabel="Add service">
            <ServiceFields />
          </ActionForm>
        </div>
      </section>

      <p className="mt-8 text-sm text-ink-soft">
        SKUs and their weights live on the <Link href="/admin/inventory" className="text-brand hover:text-brand-deep">Inventory</Link> page.
      </p>
    </div>
  );
}
