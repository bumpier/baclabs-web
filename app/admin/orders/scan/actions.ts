"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import {
  markPacked,
  openPickList,
  PickingError,
  recordPickScan,
  resetPicks,
  type PickView,
  type ScanResult,
} from "@/lib/inventory/picking";

/**
 * The scan station calls these on every scan, not through a <form>, so each
 * returns a plain result for it to beep on. Packers are allowed — this is
 * their job — and middleware already keeps them to /admin/orders/*.
 */
export type StationResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<StationResult<T>> {
  await requireAdmin();
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof PickingError) return { ok: false, error: err.message };
    console.error("[internal] scan station", err);
    return { ok: false, error: "Something went wrong — scan again" };
  }
}

const orderId = z.string().uuid();
const scanText = z.string().max(200);

export async function openPickListAction(raw: string): Promise<StationResult<PickView>> {
  return run(() => openPickList(scanText.parse(raw)));
}

export async function recordScanAction(id: string, raw: string): Promise<StationResult<ScanResult>> {
  return run(() => recordPickScan(orderId.parse(id), scanText.parse(raw)));
}

export async function resetPicksAction(id: string): Promise<StationResult<PickView>> {
  return run(() => resetPicks(orderId.parse(id)));
}

export async function markPackedAction(id: string): Promise<StationResult<PickView>> {
  const result = await run(() => markPacked(orderId.parse(id)));
  if (result.ok) {
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${id}`);
  }
  return result;
}
