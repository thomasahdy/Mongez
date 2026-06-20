-- CreateEnum
CREATE TYPE "NotificationFunnelStage" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'ACTED_UPON', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannelType" ADD VALUE 'WHATSAPP';
ALTER TYPE "NotificationChannelType" ADD VALUE 'TELEGRAM';

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "channel" "NotificationChannelType" NOT NULL,
    "eventType" TEXT NOT NULL,
    "stage" "NotificationFunnelStage" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "waId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "waMessageId" TEXT,
    "fromPhone" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "templateName" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_messages" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "tgMessageId" INTEGER,
    "chatId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_events_notificationId_stage_idx" ON "notification_events"("notificationId", "stage");

-- CreateIndex
CREATE INDEX "notification_events_userId_channel_createdAt_idx" ON "notification_events"("userId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "notification_events_spaceId_eventType_createdAt_idx" ON "notification_events"("spaceId", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_spaceId_key" ON "whatsapp_accounts"("spaceId");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_phoneNumber_idx" ON "whatsapp_contacts"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_userId_spaceId_key" ON "whatsapp_contacts"("userId", "spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_waMessageId_key" ON "whatsapp_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_spaceId_createdAt_idx" ON "whatsapp_messages"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_messages_waMessageId_idx" ON "whatsapp_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_otp_codes_phoneNumber_createdAt_idx" ON "whatsapp_otp_codes"("phoneNumber", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_otp_codes_userId_spaceId_idx" ON "whatsapp_otp_codes"("userId", "spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_spaceId_key" ON "telegram_accounts"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_contacts_userId_spaceId_key" ON "telegram_contacts"("userId", "spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_contacts_chatId_spaceId_key" ON "telegram_contacts"("chatId", "spaceId");

-- CreateIndex
CREATE INDEX "telegram_messages_spaceId_createdAt_idx" ON "telegram_messages"("spaceId", "createdAt");
