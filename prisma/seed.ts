/**
 * Seed: creates the admin login, and nothing else.
 *
 * The product row and its Stripe Prices are NOT created here — they come from
 * `npx tsx scripts/stripe-setup.ts --apply`, which is the single place prices
 * are written so Stripe and the database can never disagree.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npx prisma db seed
 *
 * Idempotent: re-running updates the existing admin's password rather than
 * failing on the unique email.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "Skipping admin seed: set ADMIN_EMAIL and ADMIN_PASSWORD to create one.\n" +
        "  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npx prisma db seed"
    );
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, active: true, role: "ADMIN" },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      name: "Administrator",
      role: "ADMIN",
      active: true,
    },
  });

  console.log(`Admin ready: ${admin.email} (role ${admin.role})`);
  console.log("Next: npx tsx scripts/stripe-setup.ts --apply");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
