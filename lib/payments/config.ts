// Single source of truth for which payment methods are enabled and usable.
// Enablement is by explicit env flag; usability also requires the keys to be
// present (or, in development, falls back to the /dev/* simulators).

import { GATEWAY_PROVIDER } from "@/lib/crypto-gateway";
import type { BrandPaymentProviderId } from "@/brands/types";

export type PaymentMethodId = "card" | "btc" | "eth" | "usdt" | "xmr";
/**
 * Order.paymentProvider. "stripe" and the crypto gateway are BacLab's; the
 * brands' providers (lib/commerce/payments) are never BacLab's and BacLab
 * never uses them.
 */
export type PaymentProvider = "stripe" | typeof GATEWAY_PROVIDER | BrandPaymentProviderId;

/** A stored provider id as staff read it. BacLab's ids stay as stored. */
export function providerLabel(provider: string | null): string {
  return provider === "paypal" ? "PayPal" : (provider ?? "—");
}

export interface ProviderState {
  enabled: boolean; // the env flag
  configured: boolean; // required keys present
  mock: boolean; // dev simulator stands in (enabled, not configured, dev)
}

export interface PaymentConfig {
  stripe: ProviderState;
  crypto: ProviderState;
  methods: PaymentMethodId[]; // usable methods, in display order
}

const CRYPTO_METHODS: PaymentMethodId[] = ["btc", "eth", "usdt", "xmr"];

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getPaymentConfig(): PaymentConfig {
  const stripeEnabled = process.env.STRIPE_ENABLED === "true";
  const stripeConfigured =
    !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
  const stripeMock = stripeEnabled && !stripeConfigured && isDev();

  // Crypto defaults ON when unset, to preserve existing deployments.
  const cryptoEnabled = process.env.CRYPTO_ENABLED !== "false";
  // BOTH are required. CRYPTO_GATEWAY_URL once had a hardcoded fallback to
  // another storefront's gateway; with that gone, an unset URL must remove the
  // payment method rather than surface it and fail at checkout.
  const cryptoConfigured =
    !!process.env.CRYPTO_WEBHOOK_SECRET && !!process.env.CRYPTO_GATEWAY_URL;
  const cryptoMock = cryptoEnabled && !cryptoConfigured && isDev();

  const methods: PaymentMethodId[] = [];
  if (stripeEnabled && (stripeConfigured || stripeMock)) methods.push("card");
  if (cryptoEnabled && (cryptoConfigured || cryptoMock)) methods.push(...CRYPTO_METHODS);

  return {
    stripe: { enabled: stripeEnabled, configured: stripeConfigured, mock: stripeMock },
    crypto: { enabled: cryptoEnabled, configured: cryptoConfigured, mock: cryptoMock },
    methods,
  };
}

export function providerForMethod(method: PaymentMethodId): PaymentProvider {
  return method === "card" ? "stripe" : GATEWAY_PROVIDER;
}

/** Log a loud, actionable warning when a provider is enabled but unusable. */
export function warnMisconfiguredPayments(): void {
  const c = getPaymentConfig();
  if (c.stripe.enabled && !c.stripe.configured && !c.stripe.mock) {
    console.error(
      "[payments] STRIPE_ENABLED=true but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET is missing — card payments are DISABLED until you set them."
    );
  }
  if (c.crypto.enabled && !c.crypto.configured && !c.crypto.mock) {
    console.error(
      "[payments] Crypto is enabled but CRYPTO_WEBHOOK_SECRET is missing — crypto payments are DISABLED until you set it."
    );
  }
}
