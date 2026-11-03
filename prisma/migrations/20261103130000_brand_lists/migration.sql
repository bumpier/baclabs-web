-- One mailing list and one opt-out list per brand (brands/registry.ts).
--
-- Subscriber: the same address may sign up to several brands, each with its
-- own consent record, so the unique key becomes (brand, email). Only the
-- index changes; every existing row is already 'baclab'.
DROP INDEX "Subscriber_email_key";
CREATE UNIQUE INDEX "Subscriber_brand_email_key" ON "Subscriber"("brand", "email");

-- EmailOptOut: keyed by (email, brand). brand '*' is a suppression for every
-- brand (a bounce or a complaint). SQLite cannot change a primary key in
-- place, so the table is rebuilt; every existing row was a BacLab
-- unsubscribe and is copied across as 'baclab'.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailOptOut" (
    "email" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'baclab',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("email", "brand")
);
INSERT INTO "new_EmailOptOut" ("email", "createdAt") SELECT "email", "createdAt" FROM "EmailOptOut";
DROP TABLE "EmailOptOut";
ALTER TABLE "new_EmailOptOut" RENAME TO "EmailOptOut";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
