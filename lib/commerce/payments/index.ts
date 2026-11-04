/**
 * Which payment providers a brand may use right now: the ones its profile
 * lists (BrandProfile.paymentProviders), in that order, that have an adapter
 * here and whose credentials are set for that brand. The checkout takes
 * payment only through these, and the storefront offers only these
 * (lib/commerce/storefront.ts), so a brand with none shows no checkout
 * button and its checkout answers 503.
 *
 * SERVER ONLY: configured() reads the brand's credentials from env.
 *
 * BacLab is never here. Its card payments are Stripe's, on its own path
 * (app/api/checkout/route.ts), and no brand ever reaches that account.
 */
import { DEFAULT_BRAND, type BrandPaymentProviderId, type BrandProfile } from "@/brands/types";
import type { PaymentAdapter } from "@/lib/commerce/payments/types";
import { paypalAdapter } from "@/lib/commerce/payments/paypal";

export type { PaymentAdapter, PaymentOrder, PaymentContext, CreatedPayment } from "@/lib/commerce/payments/types";

/** Every adapter there is, by provider id. Card processors join once an account is approved. */
const ADAPTERS: Partial<Record<BrandPaymentProviderId, PaymentAdapter>> = { paypal: paypalAdapter };

/**
 * Stand-ins registered by test scripts (__registerTestPaymentAdapter). Empty
 * in the app. They take the place of the adapter with the same id.
 */
const TEST_ADAPTERS = new Map<string, PaymentAdapter>();

/**
 * TESTS ONLY (scripts/): stand in for a provider's adapter, so the checkout
 * can be driven without the provider. Refuses to run in production.
 */
export function __registerTestPaymentAdapter(adapter: PaymentAdapter): void {
  if (process.env.NODE_ENV === "production") throw new Error("__registerTestPaymentAdapter is for test scripts only");
  TEST_ADAPTERS.set(adapter.id, adapter);
}

/** TESTS ONLY: drop every stand-in. */
export function __clearTestPaymentAdapters(): void {
  TEST_ADAPTERS.clear();
}

/** The adapter for a provider id, configured or not. */
export function paymentAdapter(id: string): PaymentAdapter | null {
  return TEST_ADAPTERS.get(id) ?? ADAPTERS[id as BrandPaymentProviderId] ?? null;
}

/**
 * The providers this brand can take payment through now, in its profile's
 * order. Listed on the profile AND configured with the brand's own
 * credentials: neither alone is enough, so a brand with an empty list (the
 * gym brand) never takes payment however its env is set.
 */
export function brandPaymentAdapters(brand: Pick<BrandProfile, "id" | "paymentProviders">): PaymentAdapter[] {
  if (brand.id === DEFAULT_BRAND) return [];
  const out: PaymentAdapter[] = [];
  for (const id of brand.paymentProviders ?? []) {
    const adapter = paymentAdapter(id);
    if (adapter && adapter.configured(brand) && !out.includes(adapter)) out.push(adapter);
  }
  return out;
}

export type PaymentChoice = { ok: true; adapter: PaymentAdapter } | { ok: false; status: 400 | 503; error: string };

/**
 * The provider a checkout request pays through: the one its `method` names,
 * when the brand offers several, else the only one there is. No provider at
 * all is a 503 in neutral words (the storefront shows it as it stands).
 */
export function choosePaymentAdapter(
  brand: Pick<BrandProfile, "id" | "paymentProviders">,
  method: string | undefined,
  unavailable: string
): PaymentChoice {
  const offered = brandPaymentAdapters(brand);
  if (offered.length === 0) return { ok: false, status: 503, error: unavailable };
  if (method !== undefined) {
    const named = offered.find((a) => a.id === method);
    return named ? { ok: true, adapter: named } : { ok: false, status: 400, error: "That payment method is not available." };
  }
  if (offered.length === 1) return { ok: true, adapter: offered[0]! };
  return { ok: false, status: 400, error: "Choose how you would like to pay." };
}
