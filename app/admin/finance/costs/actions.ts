"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession, requireAdminRole } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { FROM_THE_START, parsePounds, type CostKind } from "@/lib/finance/rates";
import type { FormState } from "@/lib/form-state";
import { parseDayKey } from "@/lib/saleTime";
import { SETTING_KEYS, writeSetting } from "@/lib/settings";

// Every page that shows a cost or a figure after costs.
function revalidateFinance() {
  for (const path of ["/admin/finance", "/admin/finance/costs", "/admin/takings", "/admin"]) revalidatePath(path);
}

async function saveRate(kind: CostKind, key: string, formData: FormData): Promise<FormState> {
  const amountMinor = parsePounds(String(formData.get("amount") ?? ""));
  if (amountMinor === null) return { error: "Enter a price in pounds, e.g. 3.10" };
  const rawFrom = String(formData.get("from") ?? "").trim();
  const effectiveFrom = rawFrom ? parseDayKey(rawFrom) : FROM_THE_START;
  if (!effectiveFrom) return { error: "That date is not a real day" };

  const session = await getAdminSession();
  const actor = session?.adminUserId ?? "admin";
  // A second price for the same day replaces the first: that is a correction.
  await prisma.costRate.upsert({
    where: { kind_key_effectiveFrom: { kind, key, effectiveFrom } },
    update: { amountMinor, actor },
    create: { kind, key, amountMinor, effectiveFrom, actor },
  });
  revalidateFinance();
  return {
    success:
      effectiveFrom === FROM_THE_START
        ? "Saved. It applies to every order, back to the first."
        : `Saved. It applies to orders from ${effectiveFrom}; earlier days keep the price before it.`,
  };
}

export async function saveFulfilmentRateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  return saveRate("fulfilment", "", formData);
}

export async function savePostageRateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const serviceCode = String(formData.get("serviceCode") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(serviceCode)) return { error: "Unknown service" };
  return saveRate("postage", serviceCode, formData);
}

export async function deleteCostRateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const { count } = await prisma.costRate.deleteMany({ where: { id } });
  if (count === 0) return { error: "That price was already removed" };
  revalidateFinance();
  return { success: "Removed." };
}

export async function saveVatAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminRole("ADMIN");
  if (formData.get("registered") !== "on") {
    await writeSetting(SETTING_KEYS.vatRegisteredFrom, "");
    revalidateFinance();
    return { success: "Saved: not VAT registered. Figures carry no VAT." };
  }
  const from = parseDayKey(String(formData.get("vatFrom") ?? "").trim());
  if (!from) return { error: "Enter the day the registration took effect" };
  await writeSetting(SETTING_KEYS.vatRegisteredFrom, from);
  revalidateFinance();
  return { success: `Saved. VAT comes off takings from ${from}.` };
}
