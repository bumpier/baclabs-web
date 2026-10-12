"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import { normEmail, previousOrderCount } from "@/lib/mailing-list";
import type { FormState } from "@/lib/form-state";
import { MAX_GIFT_VIALS, giftExpiresAt, giftStatus, sendGiftEmail, waitingVials } from "@/lib/vial-gifts";

/** `confirm`: the error is a warning, and ticking "Send anyway" gets past it. */
export type GiftFormState = FormState & { confirm?: boolean };

const emailField = z.string().trim().email("Enter a valid email address").max(254);

const freeVials = (n: number) => (n === 1 ? "1 free vial" : `${n} free vials`);

/**
 * Promise free vials to an email's next order and tell the customer. Checks
 * first for the two ways an email goes wrong: an address with no orders (a
 * typo, or a different email from the one they order with) and one that has
 * opted out of our emails. Either needs "Send anyway".
 */
export async function addVialGiftAction(_prev: GiftFormState, formData: FormData): Promise<GiftFormState> {
  await requireAdminRole("ADMIN");
  const parsed = emailField.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
  const email = normEmail(parsed.data);
  const raw = String(formData.get("vials") ?? "").trim();
  const vials = /^\d+$/.test(raw) ? Number(raw) : 0;
  if (vials < 1 || vials > MAX_GIFT_VIALS) return { error: `Enter a whole number of vials from 1 to ${MAX_GIFT_VIALS}` };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  if (formData.get("anyway") !== "on") {
    const [orders, optOut, subscriber] = await Promise.all([
      previousOrderCount(email),
      prisma.emailOptOut.findUnique({ where: { email } }),
      prisma.subscriber.findUnique({ where: { email }, select: { status: true } }),
    ]);
    const warnings: string[] = [];
    if (orders === 0) warnings.push(`No paid orders have been placed with ${email}. Check the spelling.`);
    if (optOut || subscriber?.status === "unsubscribed") {
      warnings.push(`${email} has unsubscribed from our emails, and this one would still go to them.`);
    }
    if (warnings.length > 0) {
      return { error: `${warnings.join(" ")} Tick “Send anyway” to add the vials and email them.`, confirm: true };
    }
  }

  const session = await getAdminSession();
  const gift = await prisma.vialGift.create({
    data: { email, vials, note, actor: session?.adminUserId ?? "admin", expiresAt: giftExpiresAt(new Date()) },
  });
  const emailed = await sendGiftEmail(gift);
  revalidatePath("/admin/free-vials");

  const total = await waitingVials(email);
  const waiting = total > vials ? ` They now have ${total} free vials waiting.` : "";
  // Saved either way, so this is a success: an error would leave the form
  // filled in, inviting a second gift.
  return {
    success: emailed
      ? `Added ${freeVials(vials)} for ${email} and emailed them.${waiting}`
      : `Added ${freeVials(vials)} for ${email}, but the email didn’t send. Use “Send email again” below.${waiting}`,
  };
}

export async function cancelVialGiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  // The same conditions fulfilment claims on, so a gift is either used or cancelled, never both.
  const { count } = await prisma.vialGift.updateMany({
    where: { id, orderId: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  if (count === 0) return { error: "That was already used or cancelled" };
  revalidatePath("/admin/free-vials");
  return { success: "Cancelled." };
}

export async function resendVialGiftEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const gift = await prisma.vialGift.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!gift || giftStatus(gift, new Date()) !== "waiting") return { error: "That is no longer waiting" };
  const sent = await sendGiftEmail(gift);
  revalidatePath("/admin/free-vials");
  return sent ? { success: "Sent." } : { error: "It didn’t send. Check the email settings and try again." };
}
