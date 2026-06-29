-- DropForeignKey
ALTER TABLE "decision_records" DROP CONSTRAINT "decision_records_spaceId_fkey";

-- DropForeignKey
ALTER TABLE "decision_records" DROP CONSTRAINT "decision_records_workflowInstanceId_fkey";

-- AlterTable
ALTER TABLE "ai_memory_profiles" ADD COLUMN     "accessCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "favoriteBoardIds" JSONB,
ADD COLUMN     "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "language" TEXT DEFAULT 'en',
ADD COLUMN     "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "preferredReportStyle" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'UTC',
ALTER COLUMN "preferences" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "activities_data_idx" ON "activities" USING GIN ("data");

-- CreateIndex
CREATE INDEX "notifications_userId_spaceId_readAt_idx" ON "notifications"("userId", "spaceId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_spaceId_createdAt_idx" ON "notifications"("userId", "spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_boardId_columnId_position_idx" ON "tasks"("boardId", "columnId", "position");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
