-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AI_ESCALATION';

-- AlterTable
ALTER TABLE "telegram_accounts" ADD COLUMN "webhookPathId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_webhookPathId_key" ON "telegram_accounts"("webhookPathId");

-- CreateIndex
CREATE INDEX "boards_deletedAt_idx" ON "boards"("deletedAt");

-- CreateIndex
CREATE INDEX "board_columns_deletedAt_idx" ON "board_columns"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks"("deletedAt");
