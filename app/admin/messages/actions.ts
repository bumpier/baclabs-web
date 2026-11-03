"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import type { FormState } from "@/lib/form-state";

const idField = z.string().min(1).max(40);

/** Mark handled, or reopen. Handled is when the /privacy retention clock starts. */
export async function setMessageStatusAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = idField.parse(formData.get("id"));
  const status = z.enum(["open", "closed"]).parse(formData.get("status"));
  await prisma.contactMessage.update({
    where: { id },
    data: { status, closedAt: status === "closed" ? new Date() : null },
  });
  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${id}`);
}

/** Erase it: an erasure request, or spam. */
export async function deleteMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = idField.parse(formData.get("id"));
  try {
    await prisma.contactMessage.delete({ where: { id } });
  } catch (err) {
    console.error("[admin] delete message failed", err);
    return { error: "Could not delete that message." };
  }
  revalidatePath("/admin/messages");
  redirect("/admin/messages");
}
