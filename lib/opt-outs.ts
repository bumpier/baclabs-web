import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normEmail } from "@/lib/mailing-list";

// "Never email this person", per brand (EmailOptOut). Every marketing
// sender asks isOptedOut() with the brand of the row it is handling, and
// nothing else reads or writes the table outside the admin.
//
// Two kinds of row:
//  - brand = a brand id: the person unsubscribed from that brand's emails
//    (the unsubscribe link, or an admin). Another brand may still email
//    them if they are on its list or bought from it: to the customer they
//    are separate shops, and leaving one says nothing about the other.
//  - brand = ALL_BRANDS ("*"): the mailbox itself said no. A hard bounce or a
//    spam complaint is about the address, not the brand, and every brand
//    sends through the same Resend account, whose sending reputation they
//    share. suppressEverywhere() writes it. Nothing records bounces or
//    complaints yet (there is no Resend webhook); when one is added, it calls
//    suppressEverywhere().
//
// A fresh signup lifts that brand's own row (clearOptOut) but never the
// "*" row: anyone can type an address into a form, and a complaint is the
// strongest "no" there is. Only someone in the admin should lift it.

/** EmailOptOut.brand for a suppression that covers every brand. Never a brand id. */
export const ALL_BRANDS = "*";

type Db = Prisma.TransactionClient | typeof prisma;

/** The EmailOptOut.brand values that stop an email from `brand`. */
export function optOutScope(brand: string): string[] {
  return [brand, ALL_BRANDS];
}

/** Has this address opted out of `brand`'s emails, or been suppressed for every brand? */
export async function isOptedOut(email: string, brand: string, db: Db = prisma): Promise<boolean> {
  const row = await db.emailOptOut.findFirst({
    where: { email: normEmail(email), brand: { in: optOutScope(brand) } },
    select: { email: true },
  });
  return row !== null;
}

/** Every address `brand` must not email, lower-cased: for building an audience in one query. */
export async function optedOutEmails(brand: string, db: Db = prisma): Promise<Set<string>> {
  const rows = await db.emailOptOut.findMany({ where: { brand: { in: optOutScope(brand) } }, select: { email: true } });
  return new Set(rows.map((r) => normEmail(r.email)));
}

/** Opt this address out of one brand's emails. Idempotent. */
export async function optOut(email: string, brand: string, db: Db = prisma): Promise<void> {
  const e = normEmail(email);
  await db.emailOptOut.upsert({ where: { email_brand: { email: e, brand } }, update: {}, create: { email: e, brand } });
}

/** Stop every brand emailing this address: a hard bounce or a spam complaint. Idempotent. */
export async function suppressEverywhere(email: string, db: Db = prisma): Promise<void> {
  await optOut(email, ALL_BRANDS, db);
}

/**
 * A fresh, explicit opt-in to `brand` overrides that brand's earlier
 * unsubscribe. Leaves other brands' rows and any every-brand suppression.
 */
export async function clearOptOut(email: string, brand: string, db: Db = prisma): Promise<void> {
  await db.emailOptOut.deleteMany({ where: { email: normEmail(email), brand } });
}
