"use server";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalOrigin } from "@/lib/site-url";
import bcrypt from "bcryptjs";
import {
  createAdminSession,
  createAdminUserSession,
  destroyAdminSession,
  requireAdmin,
  requireAdminRole,
  verifyAdminPassword,
} from "@/lib/adminAuth";
import {
  clearFailures,
  isLockedOut,
  rateLimit,
  recordFailure,
} from "@/lib/rateLimit";
import { ProductSchema } from "@/lib/validation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";

async function ip(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : "local";
}

// ── Session ──────────────────────────────────────────────────────

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const key = `admin-login:${await ip()}`;
  if (isLockedOut(key)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }
  if (!rateLimit(`${key}:req`, 10, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const emailRaw = formData.get("email");
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }

  // AdminUser login (email provided)
  if (typeof emailRaw === "string" && emailRaw.trim()) {
    const email = emailRaw.trim().toLowerCase();
    const adminUser = await prisma.adminUser.findUnique({ where: { email } });
    if (
      !adminUser ||
      !adminUser.active ||
      !(await bcrypt.compare(password, adminUser.passwordHash))
    ) {
      recordFailure(key);
      return { error: "Invalid credentials" };
    }
    clearFailures(key);
    await createAdminUserSession(adminUser);
    redirect(adminUser.role === "PACKER" ? "/admin/orders" : "/admin");
  }

  // Env-var super-admin fallback (no email)
  if (!(await verifyAdminPassword(password))) {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }
  clearFailures(key);
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ── Orders ───────────────────────────────────────────────────────

const orderStatusSchema = z.enum(["pending", "paid", "packed", "shipped", "delivered", "cancelled"]);

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("orderId"));
  const status = orderStatusSchema.parse(formData.get("status"));

  const order = await prisma.order.update({ where: { id }, data: { status } });

  if (status === "shipped") {
    const { sendOrderShippedEmail } = await import("@/lib/customer-email");
    void sendOrderShippedEmail(order);
  } else if (status === "delivered") {
    const { sendOrderDeliveredEmail } = await import("@/lib/customer-email");
    void sendOrderDeliveredEmail(order);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

// ── Products ─────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function saveUploadedImage(file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Only JPEG, PNG or WebP images are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5MB");

  // Random UUID filename — original name is never used (path traversal safe)
  const name = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

export async function saveProductAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    priceGbp: formData.get("priceGbp"),
    stock: formData.get("stock"),
    weightGrams: formData.get("weightGrams"),
    supplyDays: formData.get("supplyDays"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid product details" };
  }
  const d = parsed.data;
  const productId = formData.get("productId");

  let imagePath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imagePath = await saveUploadedImage(image);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Image upload failed" };
    }
  }

  const data = {
    name: d.name,
    slug: d.slug,
    description: d.description,
    priceGbp: d.priceGbp,
    stock: d.stock,
    weightGrams: d.weightGrams,
    supplyDays: d.supplyDays,
    active: d.active,
  };

  try {
    if (typeof productId === "string" && productId) {
      const id = z.string().uuid().parse(productId);
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) return { error: "Product not found" };
      await prisma.product.update({
        where: { id },
        data: {
          ...data,
          images: imagePath ? JSON.stringify([imagePath]) : existing.images,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          ...data,
          images: JSON.stringify(imagePath ? [imagePath] : []),
        },
      });
    }
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "That slug is already in use" };
    }
    console.error("[internal] save product failed", err);
    return { error: "Something went wrong" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().uuid().parse(formData.get("productId"));
  // Soft delete — orders reference product data as a JSON snapshot
  await prisma.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}
