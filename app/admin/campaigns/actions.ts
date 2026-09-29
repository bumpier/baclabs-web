"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import type { FormState } from "@/lib/form-state";
import {
  createStripeOffer,
  offerSummary,
  processCampaign,
  retryFailed,
  sendTestEmail,
  startCampaign,
  type AudienceSpec,
} from "@/lib/campaigns";
import { getStripe } from "@/lib/payments/stripe";

const CampaignSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject").max(200),
  preheader: z.string().trim().max(200),
  bodyMarkdown: z.string().max(50_000),
});

function audienceFrom(formData: FormData): AudienceSpec {
  const on = (k: string) => formData.get(k) === "on";
  const days = Number(formData.get("lapsedDays"));
  return {
    subscribers: on("subscribers"),
    subscribersNotOrdered: on("subscribersNotOrdered"),
    customers: on("customers"),
    lapsedCustomers: on("lapsedCustomers"),
    lapsedDays: Number.isFinite(days) && days >= 1 && days <= 3650 ? Math.floor(days) : 90,
  };
}

async function draft(id: string) {
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) throw new Error("Campaign not found");
  return c;
}

/** Create a draft, or save changes to one. New drafts go to their own page. */
export async function saveCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const parsed = CampaignSchema.safeParse({
    subject: formData.get("subject") ?? "",
    preheader: formData.get("preheader") ?? "",
    bodyMarkdown: formData.get("bodyMarkdown") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const data = { ...parsed.data, audience: JSON.stringify(audienceFrom(formData)) };
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    const c = await draft(id);
    if (c.status !== "draft") return { error: "This campaign has been sent and can no longer be edited." };
    await prisma.campaign.update({ where: { id }, data });
    revalidatePath(`/admin/campaigns/${id}`);
    return { success: "Saved." };
  }

  const session = await getAdminSession();
  const created = await prisma.campaign.create({
    data: { ...data, createdBy: session?.adminUserId ?? "admin" },
  });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${created.id}`);
}

const OfferSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["percent", "amount"]),
  value: z.coerce.number().positive("Enter the discount"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Codes are 3 to 30 letters, numbers, - or _"),
  expires: z.string().optional(),
  maxRedemptions: z.string().optional(),
});

/** Create the Stripe coupon and promotion code, and attach it to the draft. */
export async function createOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const parsed = OfferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the offer" };
  const o = parsed.data;
  const c = await draft(o.id);
  if (c.status !== "draft") return { error: "This campaign has been sent." };
  if (c.promoCode) return { error: "Remove the current offer first." };
  if (!process.env.STRIPE_SECRET_KEY) return { error: "Stripe is not configured, so a code cannot be created." };

  const value = o.kind === "percent" ? Math.round(o.value) : Math.round(o.value * 100);
  if (o.kind === "percent" && (value < 1 || value > 100)) return { error: "A percentage is 1 to 100." };
  // End of the chosen day, UK time is close enough: 23:59 UTC.
  const expiresAt = o.expires ? new Date(`${o.expires}T23:59:00Z`) : null;
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now())) {
    return { error: "The end date must be in the future." };
  }
  const max = o.maxRedemptions ? Math.floor(Number(o.maxRedemptions)) : null;
  if (max !== null && (!Number.isFinite(max) || max < 1)) return { error: "The limit must be 1 or more." };

  try {
    const offer = { kind: o.kind, value, code: o.code, expiresAt, maxRedemptions: max };
    const { couponId, promotionCodeId } = await createStripeOffer(offer);
    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        promoCode: o.code,
        stripeCouponId: couponId,
        stripePromotionCodeId: promotionCodeId,
        offerSummary: offerSummary(offer),
        offerExpiresAt: expiresAt,
      },
    });
  } catch (err) {
    console.error("[campaigns] creating the Stripe offer failed", err);
    return { error: `Stripe refused the code: ${err instanceof Error ? err.message : "unknown error"}` };
  }
  revalidatePath(`/admin/campaigns/${c.id}`);
  return { success: `Code ${o.code} is live on card checkout.` };
}

/** Detach the offer and switch its code off in Stripe. */
export async function removeOfferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const c = await draft(z.string().min(1).parse(formData.get("id")));
  if (c.status !== "draft") return { error: "This campaign has been sent; its code stays live." };
  if (c.stripePromotionCodeId && process.env.STRIPE_SECRET_KEY) {
    try {
      await getStripe().promotionCodes.update(c.stripePromotionCodeId, { active: false });
    } catch (err) {
      console.error("[campaigns] deactivating the promotion code failed", err);
      return { error: "Could not switch the code off in Stripe. Try again, or archive it in the Stripe dashboard." };
    }
  }
  await prisma.campaign.update({
    where: { id: c.id },
    data: { promoCode: null, stripeCouponId: null, stripePromotionCodeId: null, offerSummary: "", offerExpiresAt: null },
  });
  revalidatePath(`/admin/campaigns/${c.id}`);
  return { success: "Offer removed and its code switched off." };
}

export async function sendTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const c = await draft(z.string().min(1).parse(formData.get("id")));
  const to = z.string().trim().email().safeParse(formData.get("to"));
  if (!to.success) return { error: "Enter the address to send the test to." };
  await sendTestEmail(c, to.data);
  return { success: `Test sent to ${to.data}.` };
}

export async function sendCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = z.string().min(1).parse(formData.get("id"));
  try {
    const n = await startCampaign(id);
    // Sends in the background, in batches; the page refreshes to show progress.
    void processCampaign(id);
    revalidatePath(`/admin/campaigns/${id}`);
    revalidatePath("/admin/campaigns");
    return { success: `Sending to ${n} ${n === 1 ? "person" : "people"}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start sending." };
  }
}

export async function retryFailedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = z.string().min(1).parse(formData.get("id"));
  const n = await retryFailed(id);
  if (n === 0) return { error: "Nothing failed." };
  void processCampaign(id);
  revalidatePath(`/admin/campaigns/${id}`);
  return { success: `Retrying ${n}.` };
}

export async function deleteDraftAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const c = await draft(z.string().min(1).parse(formData.get("id")));
  if (c.status !== "draft") throw new Error("Only drafts can be deleted");
  if (c.stripePromotionCodeId && process.env.STRIPE_SECRET_KEY) {
    await getStripe()
      .promotionCodes.update(c.stripePromotionCodeId, { active: false })
      .catch((err) => console.error("[campaigns] deactivating the promotion code failed", err));
  }
  await prisma.campaign.delete({ where: { id: c.id } });
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}
