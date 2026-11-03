"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { normEmail } from "@/lib/mailing-list";
import { clearOptOut, eraseEverywhere, optOut } from "@/lib/opt-outs";
import { DEFAULT_BRAND } from "@/brands/registry";
import { isAdminBrand } from "@/lib/admin/brand-scope";
import type { FormState } from "@/lib/form-state";

const emailField = z.string().trim().email("Enter a valid email address").max(254);

/**
 * Add someone by hand, e.g. who asked in person or by email. Only for people
 * who have actually asked to hear from us: the consent record says so.
 */
export async function addSubscriberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const parsed = emailField.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  const email = normEmail(parsed.data);
  // The brand whose list they asked to join; a form without one is BacLab's.
  const chosen = formData.get("brand");
  if (chosen !== null && !isAdminBrand(chosen)) return { error: "Choose a brand" };
  const brand = chosen ?? DEFAULT_BRAND;
  try {
    const data = {
      status: "subscribed",
      source: "admin",
      consentText: "Added by an admin at the subscriber's request.",
      consentAt: new Date(),
      unsubscribedAt: null,
    };
    await prisma.subscriber.upsert({
      where: { brand_email: { brand, email } },
      update: data,
      create: { brand, email, ...data },
    });
    await clearOptOut(email, brand);
    revalidatePath("/admin/subscribers");
    return { success: `${email} is subscribed.` };
  } catch (err) {
    console.error("[admin] add subscriber failed", err);
    return { error: "Could not add that subscriber." };
  }
}

/**
 * Stop emailing them. Kept on the list, marked unsubscribed, and opted out
 * of this brand only: to the customer each brand is its own shop.
 */
export async function unsubscribeSubscriberAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().min(1).parse(formData.get("id"));
  const sub = await prisma.subscriber.update({
    where: { id },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  });
  await optOut(sub.email, sub.brand);
  revalidatePath("/admin/subscribers");
}

/**
 * Erase them (a UK GDPR erasure request). Every brand is the same company,
 * so the request covers all of them: the address comes off every brand's
 * list and is suppressed for every brand (eraseEverywhere). The suppression
 * holds nothing but the address, so no later email from any brand reaches it.
 */
export async function deleteSubscriberAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().min(1).parse(formData.get("id"));
  const sub = await prisma.subscriber.findUniqueOrThrow({ where: { id }, select: { email: true } });
  await eraseEverywhere(sub.email);
  revalidatePath("/admin/subscribers");
}
