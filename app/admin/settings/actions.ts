"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/adminAuth";
import { SETTING_KEYS, parsePixelId, writeSetting } from "@/lib/settings";
import type { FormState } from "@/lib/form-state";

/**
 * Save (or clear) the Meta Pixel ID.
 *
 * Saving an EMPTY value is a supported, meaningful action: it writes an empty
 * row, which lib/settings.ts reads as "explicitly off" and which therefore
 * also overrides a stale build-time NEXT_PUBLIC_META_PIXEL_ID. Deleting the
 * row instead would fall back to that env var and look like the switch did
 * nothing.
 */
export async function saveMetaPixelAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const raw = formData.get("pixelId");
  if (typeof raw !== "string") return { error: "Invalid submission" };

  // An empty box is a deliberate "switch tracking off", not a failed parse.
  // Anything else goes through parsePixelId, which accepts the bare id, a
  // labelled one, or the whole base code block — and refuses anything it
  // cannot pin down rather than guessing. See lib/settings.ts for why
  // guessing is the dangerous option here.
  const pixelId = raw.trim() === "" ? "" : parsePixelId(raw);

  if (pixelId === null) {
    return {
      error:
        "Could not find a Pixel ID in that. Paste either the ID on its own (a number, usually 15–16 digits) or the whole base code block from Events Manager → Data sources.",
    };
  }

  try {
    await writeSetting(SETTING_KEYS.metaPixelId, pixelId);
  } catch (err) {
    console.error("[internal] saving meta pixel id failed", err);
    return { error: "Could not save. Please try again." };
  }

  revalidatePath("/admin/settings");
  // The privacy notice names the trackers that are actually running, so it
  // has to be re-rendered whenever that set changes.
  revalidatePath("/privacy");

  return {
    success: pixelId
      ? `Pixel ${pixelId} is live. It appears on the storefront within a minute — hard-refresh to see it sooner, then confirm in Events Manager.`
      : "Meta Pixel turned off. The storefront stops loading it within a minute.",
  };
}
