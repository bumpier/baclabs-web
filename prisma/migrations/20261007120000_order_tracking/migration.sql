-- AlterTable
ALTER TABLE "Order" ADD COLUMN "shippedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "deliveredAt" DATETIME;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "carrier_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Shipment" ADD COLUMN "tracking_stage" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "tracking_event" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "tracking_event_at" DATETIME;
ALTER TABLE "Shipment" ADD COLUMN "tracking_checked_at" DATETIME;

-- Backfill orders marked shipped or delivered before these columns existed.
-- The email sent at that moment is the closest record of when it happened;
-- without one, updatedAt, which is what the review request counted from
-- until now.
UPDATE "Order"
SET "deliveredAt" = COALESCE(
  (SELECT MIN("sentAt") FROM "EmailLog"
    WHERE "EmailLog"."orderId" = "Order"."id" AND "EmailLog"."type" = 'delivered'),
  "updatedAt"
)
WHERE "status" = 'delivered';

UPDATE "Order"
SET "shippedAt" = COALESCE(
  (SELECT MIN("sentAt") FROM "EmailLog"
    WHERE "EmailLog"."orderId" = "Order"."id" AND "EmailLog"."type" = 'shipped'),
  "deliveredAt",
  "updatedAt"
)
WHERE "status" IN ('shipped', 'delivered');
