/*
  Warnings:

  - You are about to drop the column `isRead` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `link` on the `notifications` table. All the data in the column will be lost.
  - Added the required column `channel` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spaceId` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'AGGREGATED', 'DELIVERED', 'READ', 'FAILED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- DropIndex
DROP INDEX "notifications_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_isRead_idx";

-- DropIndex
DROP INDEX "notifications_type_idx";

-- DropIndex
DROP INDEX "notifications_userId_idx";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "isRead",
DROP COLUMN "link",
ADD COLUMN     "aggregatedGroupId" TEXT,
ADD COLUMN     "channel" "NotificationChannelType" NOT NULL,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "spaceId" TEXT NOT NULL,
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "templateVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "quietHours" JSONB,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "pushToken" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_processedAt_createdAt_idx" ON "outbox_events"("processedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "device_sessions_userId_revokedAt_idx" ON "device_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_spaceId_status_idx" ON "notifications"("userId", "spaceId", "status");

-- CreateIndex
CREATE INDEX "notifications_aggregatedGroupId_idx" ON "notifications"("aggregatedGroupId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
