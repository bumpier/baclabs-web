-- CreateTable
CREATE TABLE "VialDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vials" INTEGER NOT NULL,
    "received_on" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "VialDelivery_received_on_idx" ON "VialDelivery"("received_on");

-- The stock the count starts from, as the owner gave it on 12 Oct 2026:
-- 250 vials in hand on 20 Sept (when SmartTrack labels began) and 1,000
-- more delivered on 8 Oct. Further deliveries are booked in on /admin/stock.
-- created_at in milliseconds, as Prisma writes it.
INSERT INTO "VialDelivery" ("id", "vials", "received_on", "note", "actor", "created_at") VALUES
    ('vial-opening-2026-09-20', 250, '2026-09-20', 'In stock when SmartTrack labels began', 'system', CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    ('vial-delivery-2026-10-08', 1000, '2026-10-08', 'Delivery', 'system', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
