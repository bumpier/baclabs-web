import { prisma } from "@/lib/db";

/**
 * Operator-editable runtime settings, stored one row per key in `Setting`.
 *
 * WHY THIS EXISTS. Every NEXT_PUBLIC_* value is inlined into the client
 * bundle by `next build` — the Dockerfile passes them as build args for
 * exactly that reason. So NEXT_PUBLIC_META_PIXEL_ID cannot be changed by an
 * operator: it needs a rebuild and a redeploy. These settings are read per
 * request instead, which is what makes /admin/settings able to turn a pixel
 * on and have it live on the next page load.
 *
 * READS MUST NEVER THROW. `next build` prerenders the storefront against a
 * placeholder SQLite URL with no schema in it (again, see the Dockerfile), so
 * every read here is wrapped and degrades to the env fallback. A missing
 * tracking id is a missing conversion; a thrown one is a failed build.
 */

/** Setting keys. Never write a bare string at a call site. */
export const SETTING_KEYS = {
  metaPixelId: "meta_pixel_id",
} as const;

/**
 * Meta Pixel ids are numeric and currently 15–16 digits. The bound is kept
 * loose so a future length change does not lock an operator out, but it stays
 * digits-only — which is also what makes it safe to interpolate into the
 * bootstrap snippet in app/api/pixel/route.ts.
 */
const PIXEL_ID_PATTERN = /^[0-9]{8,20}$/;

export function isValidPixelId(value: string): boolean {
  return PIXEL_ID_PATTERN.test(value.trim());
}

/**
 * Pull a pixel id out of whatever the operator pasted.
 *
 * They will paste one of four things, and all four must work or be refused
 * outright — the failure that matters here is not a rejected paste, it is an
 * ACCEPTED WRONG ONE, which reports to a pixel that does not exist and looks
 * exactly like a pixel that is simply not converting yet.
 *
 * Naively stripping non-digits does exactly that: `n.version='2.0'` followed
 * by an init line collapses to "20" + the real id, which is 17 digits and
 * sails through a digits-only length check.
 *
 * So the id is read from the place Meta actually puts it, in order of how
 * specific the evidence is, and anything ambiguous is refused.
 *
 * Returns null when no single id can be identified. An empty input is the
 * caller's business (it means "switch tracking off"), not this function's.
 */
export function parsePixelId(raw: string): string | null {
  const input = raw.trim();
  if (input === "") return null;

  // 1. Just the id, which is what Events Manager shows under the pixel name.
  if (PIXEL_ID_PATTERN.test(input)) return input;

  // 2. The base code snippet: the id is the one it initialises. Anything else
  //    in there — the SDK version, image dimensions — is not a candidate.
  const init = input.match(/fbq\s*\(\s*['"`]init['"`]\s*,\s*['"`]([0-9]{8,20})['"`]/);
  if (init) return init[1]!;

  // 3. The <noscript> tracking image: .../tr?id=<id>&ev=PageView
  const img = input.match(/[?&]id=([0-9]{8,20})(?:[^0-9]|$)/);
  if (img) return img[1]!;

  // 4. A labelled value — "Pixel ID: 123…", "ID 123…". Accepted only when the
  //    paste contains exactly one plausible id, so there is nothing to guess
  //    between. Runs are matched whole: a 30-digit blob is not a 20-digit id
  //    with ten characters of slack.
  const candidates = [
    ...new Set((input.match(/[0-9]+/g) ?? []).filter((run) => PIXEL_ID_PATTERN.test(run))),
  ];
  if (candidates.length === 1) return candidates[0]!;

  return null;
}

async function readSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch (err) {
    // Build-time prerender, or a genuinely unreachable database. Either way
    // the caller gets "not configured" rather than an exception.
    console.error("[internal] setting read failed", key, err);
    return null;
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Where the pixel id in force came from, for the admin panel to explain. */
export type MetaPixelStatus = {
  /** The id that will actually be served, or null when nothing will be. */
  pixelId: string | null;
  source: "database" | "environment" | "none";
  /** A saved empty value: the operator turned it off, overriding env. */
  turnedOff: boolean;
  /** The build-time fallback, shown so the panel can explain a surprise. */
  envPixelId: string | null;
};

/**
 * Resolution order, and why:
 *
 *  1. The `Setting` row, if one exists. The admin panel is the source of
 *     truth once it has been used, INCLUDING when the operator saved an empty
 *     value — that is a deliberate "off" and must beat a stale env var rather
 *     than silently fall through to it.
 *  2. NEXT_PUBLIC_META_PIXEL_ID, so existing deployments that set it at build
 *     time keep working untouched after this change.
 *  3. Nothing.
 */
export async function getMetaPixelStatus(): Promise<MetaPixelStatus> {
  const envRaw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  const envPixelId = isValidPixelId(envRaw) ? envRaw : null;

  const stored = await readSetting(SETTING_KEYS.metaPixelId);

  if (stored === null) {
    return {
      pixelId: envPixelId,
      source: envPixelId ? "environment" : "none",
      turnedOff: false,
      envPixelId,
    };
  }

  const trimmed = stored.trim();
  if (trimmed === "") {
    return { pixelId: null, source: "none", turnedOff: true, envPixelId };
  }

  // A row that somehow holds a malformed id is treated as unset rather than
  // shipped to the browser — validation happens on save, so this is defence
  // against a hand-edited database, not against the form.
  if (!isValidPixelId(trimmed)) {
    return { pixelId: envPixelId, source: envPixelId ? "environment" : "none", turnedOff: false, envPixelId };
  }

  return { pixelId: trimmed, source: "database", turnedOff: false, envPixelId };
}

/** The pixel id to serve, or null. Convenience wrapper over the status. */
export async function getMetaPixelId(): Promise<string | null> {
  return (await getMetaPixelStatus()).pixelId;
}
