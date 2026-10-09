-- AlterTable
ALTER TABLE "Order" ADD COLUMN "checkoutSubscriberId" TEXT;
ALTER TABLE "Order" ADD COLUMN "recoveredAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "recoveryEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "recoveryEmailSentAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "recoveryExpiresAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "recoveryUrl" TEXT;

-- CreateIndex
CREATE INDEX "Order_paymentRef_idx" ON "Order"("paymentRef");

-- CreateIndex
CREATE INDEX "Order_recoveryEmail_recoveryEmailSentAt_idx" ON "Order"("recoveryEmail", "recoveryEmailSentAt");
