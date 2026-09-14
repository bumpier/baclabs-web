/**
 * Test suite for lib/consent.ts. Run with `npm run test:consent`.
 * Exits non-zero on any failure, like scripts/test-content-rules.ts.
 */
import {
  CONSENT_STORAGE_KEY,
  isTrackingCookieName,
  mayLoadTrackers,
  parseConsent,
  serializeConsent,
  shouldShowBanner,
} from "@/lib/consent";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) return;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  failures++;
}

// ── Storage key ────────────────────────────────────────────────────
check("storage key is versioned", /_v\d+$/.test(CONSENT_STORAGE_KEY), CONSENT_STORAGE_KEY);

// ── parseConsent ───────────────────────────────────────────────────
check("no stored value is undecided", parseConsent(null) === null);
check("empty string is undecided", parseConsent("") === null);
check("corrupt JSON is undecided", parseConsent("{not json") === null);
check("a bare string is undecided", parseConsent('"granted"') === null);
check("an unknown choice is undecided", parseConsent('{"choice":"maybe"}') === null);
check("an array is undecided", parseConsent("[]") === null);

const now = new Date("2026-09-14T12:00:00Z");
check("granted round-trips", parseConsent(serializeConsent("granted", now)) === "granted");
check("denied round-trips", parseConsent(serializeConsent("denied", now)) === "denied");
check(
  "the decision time is recorded",
  JSON.parse(serializeConsent("granted", now)).at === now.toISOString()
);

// ── shouldShowBanner ───────────────────────────────────────────────
// Empty config renders nothing: with no tracker configured there is nothing
// to consent to, so no banner.
check(
  "no banner when no tracker is configured",
  shouldShowBanner({ choice: null, trackersConfigured: false }) === false
);
check(
  "banner when a tracker is configured and no decision exists",
  shouldShowBanner({ choice: null, trackersConfigured: true }) === true
);
check(
  "no banner once the visitor accepted",
  shouldShowBanner({ choice: "granted", trackersConfigured: true }) === false
);
check(
  "no banner once the visitor rejected",
  shouldShowBanner({ choice: "denied", trackersConfigured: true }) === false
);

// ── mayLoadTrackers ────────────────────────────────────────────────
// PECR: consent BEFORE the cookie. Undecided must behave exactly like denied.
check("undecided never loads trackers", mayLoadTrackers(null) === false);
check("denied never loads trackers", mayLoadTrackers("denied") === false);
check("granted loads trackers", mayLoadTrackers("granted") === true);

// ── isTrackingCookieName ───────────────────────────────────────────
for (const name of ["_fbp", "_fbc", "_ga", "_ga_ABC123XYZ", "_gid"]) {
  check(`${name} is a tracking cookie`, isTrackingCookieName(name) === true);
}
for (const name of ["admin_session", "cart_v2", "_gat_other", "ga", "fbp", "_fbpx"]) {
  check(`${name} is not a tracking cookie`, isTrackingCookieName(name) === false);
}

if (failures > 0) {
  console.error(`\n${failures} consent check(s) failed.`);
  process.exit(1);
}
console.log("✓ consent rules pass");
