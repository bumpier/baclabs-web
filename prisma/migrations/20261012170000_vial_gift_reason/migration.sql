-- Why the vials were given: "apology" (every gift added before this) or
-- "thanks". Picks the email and order line wording (lib/vial-gifts.ts).
ALTER TABLE "VialGift" ADD COLUMN "reason" TEXT NOT NULL DEFAULT 'apology';
