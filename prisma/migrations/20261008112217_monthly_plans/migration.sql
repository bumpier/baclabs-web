-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pack_id" TEXT NOT NULL,
    "vials_per_box" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "paid_months" INTEGER NOT NULL,
    "box_price_minor" INTEGER NOT NULL,
    "box_delivery_minor" INTEGER NOT NULL,
    "bonus_vials" INTEGER NOT NULL DEFAULT 0,
    "bonus_box" INTEGER NOT NULL DEFAULT 0,
    "bonus_value_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "paid_minor" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'checkout',
    "email" TEXT NOT NULL DEFAULT '',
    "purchase_order_id" TEXT NOT NULL,
    "upgrade_of_order_id" TEXT,
    "boxes_sent" INTEGER NOT NULL DEFAULT 0,
    "anchor_day" TEXT,
    "next_box_at" DATETIME,
    "paid_at" DATETIME,
    "cancelled_at" DATETIME,
    "refund_minor" INTEGER,
    "cancelled_by" TEXT NOT NULL DEFAULT '',
    "renewal_email_sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Plan_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "shippingAddress" TEXT NOT NULL DEFAULT '',
    "items" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "subtotalUsd" DECIMAL NOT NULL DEFAULT 0,
    "paymentRef" TEXT,
    "paymentProvider" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "amountPaidMinor" INTEGER,
    "deliveryOption" TEXT,
    "deliveryMinor" INTEGER,
    "deliveryInstructions" TEXT,
    "labelError" TEXT,
    "trackingConsent" BOOLEAN NOT NULL DEFAULT false,
    "clientIp" TEXT,
    "clientUserAgent" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "paidAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "welcomeSubscriberId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'sale',
    "planId" TEXT,
    "planBox" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("amountPaidMinor", "clientIp", "clientUserAgent", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "deliveredAt", "deliveryInstructions", "deliveryMinor", "deliveryOption", "fbc", "fbp", "id", "items", "labelError", "notes", "paidAt", "paymentMethod", "paymentProvider", "paymentRef", "shippedAt", "shippingAddress", "status", "subtotalUsd", "totalAmount", "trackingConsent", "updatedAt", "welcomeSubscriberId") SELECT "amountPaidMinor", "clientIp", "clientUserAgent", "createdAt", "currency", "customerEmail", "customerName", "customerPhone", "deliveredAt", "deliveryInstructions", "deliveryMinor", "deliveryOption", "fbc", "fbp", "id", "items", "labelError", "notes", "paidAt", "paymentMethod", "paymentProvider", "paymentRef", "shippedAt", "shippingAddress", "status", "subtotalUsd", "totalAmount", "trackingConsent", "updatedAt", "welcomeSubscriberId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");
CREATE INDEX "Order_kind_idx" ON "Order"("kind");
CREATE UNIQUE INDEX "Order_planId_planBox_key" ON "Order"("planId", "planBox");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_purchase_order_id_key" ON "Plan"("purchase_order_id");

-- CreateIndex
CREATE INDEX "Plan_status_next_box_at_idx" ON "Plan"("status", "next_box_at");

-- CreateIndex
CREATE INDEX "Plan_upgrade_of_order_id_idx" ON "Plan"("upgrade_of_order_id");

-- CreateIndex
CREATE INDEX "Plan_email_idx" ON "Plan"("email");
