/**
 * PayPal, faked, for the test scripts: fetch() is replaced so that PayPal's
 * two API hosts are answered here and every other request throws at once.
 * Nothing leaves the process. Not a test file itself: the test-*.ts scripts
 * import it.
 *
 * Tokens are answered by default; everything else goes to `respond`, which
 * a test sets per case. Every call is recorded, so a test can read the
 * exact request PayPal would have received.
 */

export interface PayPalCall {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const PAYPAL_HOSTS = new Set(["api-m.sandbox.paypal.com", "api-m.paypal.com"]);

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "paypal-debug-id": "debug-fixture" } });
}

export interface FakePayPal {
  calls: PayPalCall[];
  /** Answers every non-token call; undefined from it is a 500. */
  respond: (call: PayPalCall) => Response | undefined | Promise<Response | undefined>;
  /** Token calls made so far. */
  tokens: () => number;
  restore: () => void;
}

export function fakePayPal(): FakePayPal {
  const real = globalThis.fetch;
  let tokenCount = 0;
  const fake: FakePayPal = {
    calls: [],
    respond: () => undefined,
    tokens: () => tokenCount,
    restore: () => {
      globalThis.fetch = real;
    },
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!PAYPAL_HOSTS.has(url.hostname)) throw new Error(`no network in tests: ${url.href}`);
    const call: PayPalCall = {
      method: init?.method ?? "GET",
      url,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : "",
    };
    fake.calls.push(call);
    if (url.pathname === "/v1/oauth2/token") {
      tokenCount++;
      return json(200, { access_token: `token-${tokenCount}`, token_type: "Bearer", expires_in: 32400 });
    }
    return (await fake.respond(call)) ?? json(500, { name: "INTERNAL_SERVER_ERROR" });
  }) as typeof fetch;
  return fake;
}

/** Set a brand's four PayPal variables (lib/commerce/payments/paypal.ts). */
export function setPayPalEnv(brandId: string, environment: string = "sandbox"): void {
  const id = brandId.toUpperCase();
  process.env[`PAYPAL_CLIENT_ID__${id}`] = `client-${brandId}`;
  process.env[`PAYPAL_CLIENT_SECRET__${id}`] = `secret-${brandId}`;
  process.env[`PAYPAL_WEBHOOK_ID__${id}`] = `webhook-${brandId}`;
  process.env[`PAYPAL_ENV__${id}`] = environment;
}

export function clearPayPalEnv(): void {
  for (const k of Object.keys(process.env)) if (k.startsWith("PAYPAL_")) delete process.env[k];
}

/** A PayPal order as the show-details and capture calls return it. */
export function paypalOrderJson(o: {
  id: string;
  status: string;
  customId: string;
  country?: string;
  capture?: { id: string; status: string; value: string; currency?: string };
}): Record<string, unknown> {
  return {
    id: o.id,
    status: o.status,
    intent: "CAPTURE",
    payment_source: {
      paypal: {
        email_address: "buyer@example.com",
        account_id: "PAYERFIXTURE",
        name: { given_name: "Sam", surname: "Buyer" },
        phone_number: { national_number: "07700900123" },
      },
    },
    purchase_units: [
      {
        reference_id: "default",
        custom_id: o.customId,
        invoice_id: o.customId,
        shipping: {
          name: { full_name: "Sam Buyer" },
          address: {
            address_line_1: "1 Mill Lane",
            address_line_2: "Flat 2",
            admin_area_2: "Leeds",
            postal_code: "LS1 1AA",
            country_code: o.country ?? "GB",
          },
        },
        ...(o.capture
          ? {
              payments: {
                captures: [
                  {
                    id: o.capture.id,
                    status: o.capture.status,
                    amount: { currency_code: o.capture.currency ?? "GBP", value: o.capture.value },
                    custom_id: o.customId,
                    invoice_id: o.customId,
                  },
                ],
              },
            }
          : {}),
      },
    ],
    links: [{ href: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${o.id}`, rel: "self", method: "GET" }],
  };
}

/** The headers PayPal signs a webhook with; the cert URL decides its environment. */
export function webhookHeaders(environment: "sandbox" | "live"): Headers {
  return new Headers({
    "content-type": "application/json",
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": `https://api.${environment === "sandbox" ? "sandbox." : ""}paypal.com/v1/notifications/certs/CERT-fixture`,
    "paypal-transmission-id": "transmission-fixture",
    "paypal-transmission-sig": "signature-fixture",
    "paypal-transmission-time": "2026-11-04T10:00:00Z",
  });
}
