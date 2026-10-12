-- CreateTable
CREATE TABLE "VialGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "vials" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "expires_at" DATETIME NOT NULL,
    "emailed_at" DATETIME,
    "order_id" TEXT,
    "claimed_at" DATETIME,
    "cancelled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "VialGift_email_idx" ON "VialGift"("email");

-- CreateIndex
CREATE INDEX "VialGift_order_id_idx" ON "VialGift"("order_id");
