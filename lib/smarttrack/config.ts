/**
 * SmartTrack connection settings, from env. Runtime values: restart, no
 * rebuild.
 *
 * SmartTrack runs two separate systems — UAT (qa.smarttrack.co) for testing
 * and live — each with its own account and its own API key. UAT is the
 * default, so a key pasted in without SMARTTRACK_ENV buys test labels, not
 * real postage. Going live is a deliberate `SMARTTRACK_ENV=live`.
 *
 * Docs: https://docs.smarttrack.co/?manual_documentation=get-started
 */
export type SmartTrackEnv = "uat" | "live";

const BASE_URLS: Record<SmartTrackEnv, string> = {
  uat: "https://qa.smarttrack.co/api/v2",
  live: "https://www.smarttrack.co/api/v2",
};

export interface SmartTrackConfig {
  env: SmartTrackEnv;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  /** Width x height in mm. 100x150 is the 4×6in thermal label. */
  labelSize: string;
}

export function smartTrackEnv(): SmartTrackEnv {
  return process.env.SMARTTRACK_ENV?.trim().toLowerCase() === "live" ? "live" : "uat";
}

/** Null until both halves of the key are set. */
export function smartTrackConfig(): SmartTrackConfig | null {
  const apiKey = process.env.SMARTTRACK_API_KEY?.trim() ?? "";
  const apiSecret = process.env.SMARTTRACK_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  const env = smartTrackEnv();
  const labelSize = process.env.SMARTTRACK_LABEL_SIZE?.trim() || "100x150";
  return { env, baseUrl: BASE_URLS[env], apiKey, apiSecret, labelSize };
}
