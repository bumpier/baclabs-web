-- The delivery option the customer chose at checkout, and what it cost.
ALTER TABLE "Order" ADD COLUMN "deliveryOption" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryMinor" INTEGER;
-- The customer's own instructions for the carrier. NULL = the shop default.
ALTER TABLE "Order" ADD COLUMN "deliveryInstructions" TEXT;

-- Which checkout delivery option each postal service fulfils. "" = none.
ALTER TABLE "PostalService" ADD COLUMN "delivery_option" TEXT NOT NULL DEFAULT '';
