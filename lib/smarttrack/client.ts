import { smartTrackConfig, type SmartTrackConfig } from "@/lib/smarttrack/config";

/**
 * SmartTrack REST client (API v2). Server-only: it holds the API secret.
 *
 * Every endpoint is a POST of JSON with a Bearer token, except tracking,
 * which is a GET. Tokens last an hour (docs: "Get Authentication Token"); one
 * is cached per process and renewed a minute early, and a 401 mid-life —
 * SmartTrack revoking it, the key being rotated — clears it and retries once.
 *
 * SmartTrack's responses are not uniform: most say `success: true`, some say
 * `status: "success"`, errors arrive as an array, an object keyed by
 * reference, or OAuth's `error_description`. `call` folds all of them into
 * either the data or a SmartTrackError carrying every message they sent, so
 * nothing above this file has to know.
 *
 * Numbers come back as strings ("3.000"); the types say so, and the callers
 * convert them.
 */

export class SmartTrackError extends Error {
  constructor(
    message: string,
    readonly errors: string[] = [],
    readonly httpStatus = 0
  ) {
    super(message);
    this.name = "SmartTrackError";
  }

  /** Every message SmartTrack gave, for showing to the operator. */
  get detail(): string {
    const all = [this.message, ...this.errors.filter((e) => e !== this.message)];
    return all.join(" — ");
  }
}

/**
 * Getting the access token failed, so the request it was for was never sent.
 * Callers rely on that: a label cannot have been bought behind one of these.
 */
export class SmartTrackAuthError extends SmartTrackError {
  constructor(message: string, errors: string[] = [], httpStatus = 0) {
    super(message, errors, httpStatus);
    this.name = "SmartTrackAuthError";
  }
}

export class SmartTrackNotConfiguredError extends SmartTrackError {
  constructor() {
    super("SmartTrack is not connected. Set SMARTTRACK_API_KEY and SMARTTRACK_API_SECRET, then restart.");
    this.name = "SmartTrackNotConfiguredError";
  }
}

// ── Response shapes (only the fields this codebase reads) ─────────

export interface SmartTrackService {
  service_id: string;
  service_name: string;
  service_code: string;
  service_description: string | null;
  origin_country_iso: string;
  from_weight: string; // kg
  to_weight: string; // kg
  validation_type: string;
  max_length: string; // cm
  max_width: string;
  max_height: string;
  untracked: string; // "0" | "1"
  delivery_mode: string | null;
  maximum_dim_formula: string | null; // "L+W+H"
  maximum_allowed_dimension: string | null; // cm
  delivery_countries: { country_iso: string; country_name: string; transit_time: string }[];
}

export interface SmartTrackParcelLabel {
  tracking_number: string;
  url: string;
  label_bin_string?: string;
}

export interface GenerateLabelData {
  label_url?: string;
  label_bin_str?: string;
  tracking_number: string[];
  order_reference: string;
  id: number;
  parcel_label?: SmartTrackParcelLabel[];
}

export interface GetLabelData {
  order_reference: string;
  label?: string;
  label_bin_str?: string;
  tracking_number: string[];
  parcel_label?: SmartTrackParcelLabel[];
}

export interface SmartTrackQuote {
  service_name: string;
  service_code: string;
  transit_time: string;
  volumetric_deNominator: string;
  currency_code: string;
  total: string;
}

export interface ManifestData {
  id: number;
  manifest_reference: number;
  pdf?: { url: string; bin_str?: string };
  csv?: { url: string; bin_str?: string };
}

// ── Request shapes ────────────────────────────────────────────────

export interface ParcelItemRequest {
  item_description: string;
  item_sku: string;
  no_of_items: number;
  item_value: number;
  weight: number; // kg, per item
  hscode?: string;
  manufacture_country_iso?: string;
}

export interface ParcelRequest {
  weight: number; // kg, up to 3 dp
  length: number; // cm
  width: number;
  height: number;
  itemvalue?: number;
  items?: ParcelItemRequest[];
}

/** add-shipment / generate-label. Field limits are in lib/smarttrack/payload.ts. */
export interface ShipmentRequest {
  service_code: string;
  order_reference: string;
  reference?: string;
  shipment_type: "D";
  sender_country_iso: string;
  sender_contact: string;
  sender_company?: string;
  sender_email?: string;
  sender_telephone?: string;
  sender_address_line_1: string;
  sender_address_line_2?: string;
  sender_address_line_3?: string;
  sender_city: string;
  sender_postcode: string;
  receiver_country_iso: string;
  receiver_contact: string;
  receiver_email?: string;
  receiver_telephone?: string;
  receiver_address_line_1: string;
  receiver_address_line_2?: string;
  receiver_address_line_3?: string;
  receiver_city: string;
  receiver_postcode: string;
  value: number;
  currency: string;
  description: string;
  label_type: "pdf" | "zpl";
  label_size: string;
  parcel: ParcelRequest[];
}

// ── Transport ─────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number; key: string } | null = null;

function requireConfig(): SmartTrackConfig {
  const cfg = smartTrackConfig();
  if (!cfg) throw new SmartTrackNotConfiguredError();
  return cfg;
}

/** Collect every message SmartTrack put in a response, whatever its shape. */
function messagesFrom(body: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === "object") Object.values(v).forEach(push);
  };
  push(body.errors);
  push(body.error_description);
  if (out.length === 0) push(body.message);
  // RFC 7807 problem responses, which SmartTrack sends for server errors.
  if (out.length === 0) {
    push(body.detail);
    push(body.title);
  }
  return out;
}

async function send(cfg: SmartTrackConfig, path: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new SmartTrackError(
      `Could not reach SmartTrack (${cfg.env.toUpperCase()}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new SmartTrackError(`SmartTrack sent a response that is not JSON (HTTP ${res.status})`, [], res.status);
  }
  return { status: res.status, body };
}

async function accessToken(cfg: SmartTrackConfig, forceNew = false): Promise<string> {
  const key = `${cfg.env}:${cfg.apiKey}`;
  if (!forceNew && cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  let response: Awaited<ReturnType<typeof send>>;
  try {
    response = await send(cfg, "token", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: cfg.apiKey,
        client_secret: cfg.apiSecret,
      }),
    });
  } catch (err) {
    const e = err as SmartTrackError;
    throw new SmartTrackAuthError(e.message, e.errors ?? [], e.httpStatus ?? 0);
  }
  const { status, body } = response;
  const token = typeof body.access_token === "string" ? body.access_token : "";
  if (!token) {
    throw new SmartTrackAuthError(
      status >= 500
        ? `SmartTrack's sign-in failed on their side (${cfg.env.toUpperCase()}, HTTP ${status})`
        : `SmartTrack refused the API key (${cfg.env.toUpperCase()})`,
      messagesFrom(body),
      status
    );
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  cachedToken = { token, key, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 };
  return token;
}

/** A call's data, or a SmartTrackError with everything SmartTrack said. */
async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  const cfg = requireConfig();
  const attempt = async (forceNewToken: boolean) => {
    const token = await accessToken(cfg, forceNewToken);
    return send(cfg, path, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  };

  let { status, body } = await attempt(false);
  if (status === 401) ({ status, body } = await attempt(true));

  const ok = body.success === true || body.status === "success";
  if (!ok || status >= 400) {
    const messages = messagesFrom(body);
    throw new SmartTrackError(messages[0] ?? `SmartTrack request failed (HTTP ${status})`, messages, status);
  }
  return body.data as T;
}

// ── Endpoints ─────────────────────────────────────────────────────

/** Services assigned to this account. The source of the Shipping page's limits. */
export async function getServices(serviceCode?: string): Promise<SmartTrackService[]> {
  const data = await call<SmartTrackService[] | null>("get-services", {
    method: "POST",
    body: serviceCode ? { service_code: serviceCode } : {},
  });
  return Array.isArray(data) ? data : [];
}

/** Prices for a parcel, per service. Not used to choose yet — see the design note. */
export async function getQuotes(input: {
  origin_country_iso: string;
  delivery_country_iso: string;
  origin_city: string;
  delivery_city: string;
  origin_postcode: string;
  delivery_postcode: string;
  parcel: { weight: number; length?: number; width?: number; height?: number }[];
}): Promise<SmartTrackQuote[]> {
  const data = await call<SmartTrackQuote[] | null>("get-quotes", { method: "POST", body: input });
  return Array.isArray(data) ? data : [];
}

/** Add the shipment and buy its label in one call. This is what costs money. */
export async function generateLabel(input: ShipmentRequest): Promise<GenerateLabelData> {
  return call<GenerateLabelData>("generate-label", { method: "POST", body: input });
}

/** Fetch the label of a shipment that already exists. */
export async function getLabel(orderReference: string, labelSize: string): Promise<GetLabelData> {
  return call<GetLabelData>("get-label", {
    method: "POST",
    body: { order_reference: orderReference, label_type: "pdf", label_size: labelSize },
  });
}

/** Cancel labels. SmartTrack takes the references as an object keyed "0", "1", … */
export async function voidLabels(orderReferences: string[]): Promise<string[]> {
  const data = await call<string[] | null>("void-labels", {
    method: "POST",
    body: { order_reference: Object.fromEntries(orderReferences.map((r, i) => [String(i), r])) },
  });
  return Array.isArray(data) ? data : [];
}

export async function getTracking(trackingNumber: string): Promise<unknown> {
  return call<unknown>(`get-tracking/${encodeURIComponent(trackingNumber)}`, { method: "GET" });
}

/** The end-of-day manifest a collection driver signs for. */
export async function createManifest(trackingNumbers: string[]): Promise<ManifestData> {
  return call<ManifestData>("create-manifest", {
    method: "POST",
    body: { tracking_number: Object.fromEntries(trackingNumbers.map((t, i) => [String(i), t])) },
  });
}

/** Register a SKU with SmartTrack. Units: kg and cm. */
export async function createSku(input: {
  sku: string;
  name: string;
  description: string;
  weight: number;
  length: number;
  width: number;
  height: number;
}): Promise<unknown> {
  return call<unknown>("create-sku", { method: "POST", body: input });
}

/** Proves the key works and says how many services the account has. */
export async function testConnection(): Promise<{ env: string; serviceCount: number }> {
  const cfg = requireConfig();
  await accessToken(cfg, true);
  const services = await getServices();
  return { env: cfg.env, serviceCount: services.length };
}
