-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paidAt" DATETIME;

-- Backfill orders paid before this column existed. The confirmation email is
-- sent straight after payment confirms, so its log time is the closest record
-- of when the sale happened; with no confirmation logged, fall back to when
-- checkout began. Cancelled orders only count if a confirmation went out,
-- because that is the only sign they were ever paid.
UPDATE "Order"
SET "paidAt" = COALESCE(
  (SELECT MIN("sentAt") FROM "EmailLog"
    WHERE "EmailLog"."orderId" = "Order"."id" AND "EmailLog"."type" = 'confirmation'),
  "createdAt"
)
WHERE "status" IN ('paid', 'packed', 'shipped', 'delivered')
   OR EXISTS (SELECT 1 FROM "EmailLog"
    WHERE "EmailLog"."orderId" = "Order"."id" AND "EmailLog"."type" = 'confirmation');
