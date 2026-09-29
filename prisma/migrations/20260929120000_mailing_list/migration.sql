-- AlterTable
ALTER TABLE "Order" ADD COLUMN "welcomeSubscriberId" TEXT;

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'subscribed',
    "source" TEXT NOT NULL DEFAULT 'footer',
    "consent_text" TEXT NOT NULL DEFAULT '',
    "consent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT NOT NULL DEFAULT '',
    "welcome_order_id" TEXT,
    "welcome_claimed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" DATETIME
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "preheader" TEXT NOT NULL DEFAULT '',
    "body_markdown" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "promo_code" TEXT,
    "stripe_coupon_id" TEXT,
    "stripe_promotion_code_id" TEXT,
    "offer_summary" TEXT NOT NULL DEFAULT '',
    "offer_expires_at" DATETIME,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL DEFAULT '',
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resend_id" TEXT,
    "error" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignRecipient_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_welcome_order_id_key" ON "Subscriber"("welcome_order_id");

-- CreateIndex
CREATE INDEX "Subscriber_status_created_at_idx" ON "Subscriber"("status", "created_at");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaign_id_status_idx" ON "CampaignRecipient"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaign_id_email_key" ON "CampaignRecipient"("campaign_id", "email");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

