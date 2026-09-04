"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import type { FormState } from "@/lib/form-state";

const CreateSubuserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "PACKER"]),
  password: z.string().min(8).max(128),
});

export async function createSubuserAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const parsed = CreateSubuserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid details" };
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "An account with that email already exists" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.adminUser.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  revalidatePath("/admin/subusers");
  return {
    success: `${parsed.data.role === "ADMIN" ? "Admin" : "Packer"} account created for ${parsed.data.email}`,
  };
}

export async function toggleSubuserAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().cuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  await prisma.adminUser.update({ where: { id }, data: { active: !active } });
  revalidatePath("/admin/subusers");
}

export async function deleteSubuserAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().cuid().parse(formData.get("id"));
  await prisma.adminUser.delete({ where: { id } });
  revalidatePath("/admin/subusers");
}
