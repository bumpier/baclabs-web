-- CreateTable
CREATE TABLE "CostRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "amount_minor" INTEGER NOT NULL,
    "effective_from" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CostRate_kind_key_effective_from_key" ON "CostRate"("kind", "key", "effective_from");
