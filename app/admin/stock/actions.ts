"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { parseDayKey, shopDayKey } from "@/lib/saleTime";

const MAX_VIALS = 100_000;

// Every page that shows the count or its warning.
function revalidateStock() {
  for (const path of ["/admin/stock", "/admin", "/admin/orders"]) revalidatePath(path);
}

export async function addVialDeliveryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const raw = String(formData.get("vials") ?? "").replace(/[\s,]/g, "");
  if (!/^-?\d+$/.test(raw)) return { error: "Enter a whole number of vials, e.g. 1000 (or -12 to take some off)" };
  const vials = Number(raw);
  if (vials === 0) return { error: "Enter a number other than 0" };
  if (Math.abs(vials) > MAX_VIALS) return { error: `That is more than ${MAX_VIALS.toLocaleString("en-GB")} vials` };

  const receivedOn = parseDayKey(String(formData.get("day") ?? "").trim());
  if (!receivedOn) return { error: "Choose the day they arrived" };
  if (receivedOn > shopDayKey(new Date())) return { error: "That day has not happened yet" };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const session = await getAdminSession();
  await prisma.vialDelivery.create({
    data: { vials, receivedOn, note, actor: session?.adminUserId ?? "admin" },
  });
  revalidateStock();
  const n = Math.abs(vials).toLocaleString("en-GB");
  return { success: vials > 0 ? `Booked in ${n} vials.` : `Took ${n} vials off the count.` };
}

export async function deleteVialDeliveryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const { count } = await prisma.vialDelivery.deleteMany({ where: { id } });
  if (count === 0) return { error: "That was already removed" };
  revalidateStock();
  return { success: "Removed." };
}
