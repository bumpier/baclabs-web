"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import { normEmail } from "@/lib/mailing-list";
import { clearOptOut, optOut } from "@/lib/opt-outs";
import { DEFAULT_BRAND } from "@/brands/registry";
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
  // BacLab's list until the admin can choose a brand.
  const brand = DEFAULT_BRAND;
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

/** Stop emailing them. Kept on the list, marked unsubscribed, and opted out. */
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
 * Erase them (a UK GDPR erasure request). The address stays on the opt-out
 * list, which holds nothing but the address, so no later email reaches it.
 */
export async function deleteSubscriberAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().min(1).parse(formData.get("id"));
  const sub = await prisma.subscriber.delete({ where: { id } });
  await optOut(sub.email, sub.brand);
  revalidatePath("/admin/subscribers");
}
