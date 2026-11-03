-- The storefront brand (brands/registry.ts) on every customer-facing table.
-- Plain ADD COLUMN with a default, so existing rows become 'baclab' in place
-- without rebuilding any table.
ALTER TABLE "Order" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';
ALTER TABLE "Plan" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';
ALTER TABLE "Subscriber" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';
ALTER TABLE "VialGift" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';
ALTER TABLE "Campaign" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';
ALTER TABLE "ContactMessage" ADD COLUMN "brand" TEXT NOT NULL DEFAULT 'baclab';

CREATE INDEX "Order_brand_status_createdAt_idx" ON "Order"("brand", "status", "createdAt");
