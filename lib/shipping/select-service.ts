import type { PostalService } from "@prisma/client";
import {
  chargeableGrams,
  formatDimensions,
  formatWeight,
  hasDimensions,
  sortedSides,
  type Parcel,
} from "@/lib/shipping/parcel";

/**
 * Which postal service a parcel needs, worked out from what it weighs and how
 * big it is against each service's limits — and, just as importantly, WHY:
 * every service that is passed over carries the reasons, so the order page
 * can say "Large Letter: 42 mm deep, over the 25 mm limit" rather than
 * leaving a packer to trust a choice they cannot see.
 *
 * Pure. The rows come in from PostalService, the parcel from the order's
 * SKUs (lib/shipping/order-parcel.ts).
 */

export interface ServiceRule {
  code: string;
  name: string;
  active: boolean;
  priority: number;
  minWeightGrams: number;
  /** 0 = no limit, for this and every other limit below. */
  maxWeightGrams: number;
  maxLengthMm: number;
  maxWidthMm: number;
  maxHeightMm: number;
  sizeFormula: string;
  sizeLimitMm: number;
  volumetricDivisor: number | null;
  /** Empty = delivers anywhere it is asked to. */
  deliveryCountryIsos: string[];
}

export function toServiceRule(row: PostalService): ServiceRule {
  let isos: string[] = [];
  try {
    const parsed = JSON.parse(row.deliveryCountries) as { iso?: string }[];
    isos = parsed.map((c) => (c.iso ?? "").toUpperCase()).filter(Boolean);
  } catch {
    // A malformed column restricts nothing rather than everything; the sync
    // writes it, so this only guards a hand edit.
  }
  return {
    code: row.code,
    name: row.name,
    active: row.active,
    priority: row.priority,
    minWeightGrams: row.minWeightGrams,
    maxWeightGrams: row.maxWeightGrams,
    maxLengthMm: row.maxLengthMm,
    maxWidthMm: row.maxWidthMm,
    maxHeightMm: row.maxHeightMm,
    sizeFormula: row.sizeFormula,
    sizeLimitMm: row.sizeLimitMm,
    volumetricDivisor: row.volumetricDivisor,
    deliveryCountryIsos: isos,
  };
}

// ── Size formulas ────────────────────────────────────────────────
//
// Carriers state combined-size limits as a formula over the sides:
// SmartTrack returns "L+W+H"; girth rules read "L+2W+2H" or "L+2(W+H)".
// This evaluates exactly that little language — numbers, L, W, H, + - *,
// brackets, and a number written against a letter meaning multiply — and
// returns null for anything else rather than guessing at it.

type Token = { kind: "num"; value: number } | { kind: "side"; side: "L" | "W" | "H" } | { kind: "op"; op: string };

function tokenise(formula: string): Token[] | null {
  const tokens: Token[] = [];
  const src = formula.replace(/\s+/g, "");
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ kind: "num", value: parseFloat(num[0]) });
      i += num[0].length;
    } else if (/[LWH]/i.test(ch)) {
      tokens.push({ kind: "side", side: ch.toUpperCase() as "L" | "W" | "H" });
      i++;
    } else if (ch === "x" || ch === "X" || ch === "×" || ch === "*") {
      tokens.push({ kind: "op", op: "*" });
      i++;
    } else if ("+-()".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

export function evaluateSizeFormula(formula: string, sides: readonly [number, number, number]): number | null {
  const parsed = tokenise(formula);
  if (!parsed || parsed.length === 0) return null;
  const tokens: Token[] = parsed;
  const values = { L: sides[0], W: sides[1], H: sides[2] };
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t?.kind === "op" && t.op === op;
  };
  const startsFactor = () => {
    const t = peek();
    return t !== undefined && (t.kind !== "op" || t.op === "(");
  };

  function factor(): number | null {
    const t = tokens[pos++];
    if (!t) return null;
    if (t.kind === "num") return t.value;
    if (t.kind === "side") return values[t.side];
    if (t.op === "(") {
      const inner = expr();
      if (inner === null || !isOp(")")) return null;
      pos++;
      return inner;
    }
    return null;
  }

  function term(): number | null {
    let left = factor();
    while (left !== null) {
      if (isOp("*")) {
        pos++;
      } else if (!startsFactor()) {
        break;
      }
      const right = factor();
      if (right === null) return null;
      left *= right;
    }
    return left;
  }

  function expr(): number | null {
    let left = term();
    while (left !== null && (isOp("+") || isOp("-"))) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const result = expr();
  return result !== null && pos === tokens.length ? result : null;
}

// ── Fit ──────────────────────────────────────────────────────────

export interface ServiceCheck {
  service: ServiceRule;
  fits: boolean;
  /** Empty when it fits. Every failed rule, not just the first. */
  reasons: string[];
}

const grams = (g: number) => formatWeight(g);
const mm = (n: number) => `${n.toLocaleString("en-GB")} mm`;

export function checkService(service: ServiceRule, parcel: Parcel, countryIso: string): ServiceCheck {
  const reasons: string[] = [];
  const country = countryIso.toUpperCase();

  if (!service.active) reasons.push("switched off");
  if (service.deliveryCountryIsos.length > 0 && !service.deliveryCountryIsos.includes(country)) {
    reasons.push(`does not deliver to ${country}`);
  }

  if (parcel.weightGrams <= 0) {
    reasons.push("weight not set");
  } else {
    const chargeable = chargeableGrams(parcel, service.volumetricDivisor);
    const what = chargeable > parcel.weightGrams ? "volumetric weight" : "weight";
    if (service.maxWeightGrams > 0 && chargeable > service.maxWeightGrams) {
      reasons.push(`${what} ${grams(chargeable)}, over the ${grams(service.maxWeightGrams)} limit`);
    }
    if (chargeable < service.minWeightGrams) {
      reasons.push(`${what} ${grams(chargeable)}, under the ${grams(service.minWeightGrams)} minimum`);
    }
  }

  const limitsSides = service.maxLengthMm > 0 || service.maxWidthMm > 0 || service.maxHeightMm > 0;
  const limitsFormula = service.sizeFormula.trim() !== "" && service.sizeLimitMm > 0;
  if ((limitsSides || limitsFormula) && !hasDimensions(parcel)) {
    reasons.push("size not set");
  } else if (hasDimensions(parcel)) {
    const sides = sortedSides(parcel);
    if (limitsSides) {
      // Rotate both into longest-first order; an unset limit is no limit.
      const limits = [service.maxLengthMm, service.maxWidthMm, service.maxHeightMm]
        .map((n) => (n > 0 ? n : Infinity))
        .sort((a, b) => b - a);
      if (sides.some((side, i) => side > limits[i]!)) {
        const shown = limits.map((n) => (n === Infinity ? "any" : String(n))).join(" × ");
        reasons.push(`${formatDimensions(parcel)} does not fit within ${shown} mm`);
      }
    }
    if (limitsFormula) {
      const value = evaluateSizeFormula(service.sizeFormula, sides);
      if (value === null) {
        reasons.push(`size rule "${service.sizeFormula}" not understood — check it on the Shipping page`);
      } else if (value > service.sizeLimitMm) {
        reasons.push(`${service.sizeFormula} is ${mm(Math.ceil(value))}, over the ${mm(service.sizeLimitMm)} limit`);
      }
    }
  }

  return { service, fits: reasons.length === 0, reasons };
}

// ── Selection ────────────────────────────────────────────────────

export interface ServiceSelection {
  service: ServiceRule | null;
  /** "sku": the service assigned to the SKU. "auto": worked out. */
  choice: "sku" | "auto" | null;
  /** One sentence for the order page. */
  note: string;
  /** Every service, best first, with its verdict. */
  checks: ServiceCheck[];
}

/** Preferred order among services that fit: priority, then the tightest weight band. */
function rank(a: ServiceRule, b: ServiceRule): number {
  const band = (s: ServiceRule) => (s.maxWeightGrams > 0 ? s.maxWeightGrams : Infinity);
  return a.priority - b.priority || band(a) - band(b) || a.code.localeCompare(b.code);
}

/**
 * A service assigned to the SKU wins whenever it actually fits this parcel.
 * When it does not — two units outgrowing a single's Large Letter — the
 * choice falls back to the automatic one and the note says so, rather than
 * buying a label the carrier will surcharge.
 */
export function selectService(
  services: readonly ServiceRule[],
  parcel: Parcel,
  countryIso: string,
  assignedCode: string | null = null
): ServiceSelection {
  const checks = [...services].sort(rank).map((s) => checkService(s, parcel, countryIso));
  const fitting = checks.filter((c) => c.fits);
  let fallbackNote = "";

  if (assignedCode) {
    const assigned = checks.find((c) => c.service.code === assignedCode);
    if (assigned?.fits) {
      return {
        service: assigned.service,
        choice: "sku",
        note: `${assigned.service.name} is assigned to this SKU and fits the parcel.`,
        checks,
      };
    }
    fallbackNote = assigned
      ? `The assigned service, ${assigned.service.name}, does not fit (${assigned.reasons.join("; ")}). `
      : `The assigned service ${assignedCode} is not on the Shipping page. `;
  }

  const best = fitting[0];
  if (!best) {
    return {
      service: null,
      choice: null,
      note:
        services.length === 0
          ? `${fallbackNote}No postal services are set up yet — add or sync them on the Shipping page.`
          : `${fallbackNote}No service fits a ${formatWeight(parcel.weightGrams)} parcel, ${formatDimensions(parcel)}, to ${countryIso.toUpperCase()}.`,
      checks,
    };
  }
  return {
    service: best.service,
    choice: "auto",
    note: `${fallbackNote}${best.service.name} is the first service that fits${
      fitting.length > 1 ? `, of ${fitting.length}` : ""
    }.`,
    checks,
  };
}
