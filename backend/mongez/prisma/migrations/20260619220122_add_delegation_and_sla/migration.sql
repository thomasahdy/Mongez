-- AlterTable
ALTER TABLE "workflow_instances" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "escalationPolicy" JSONB;

-- CreateTable
CREATE TABLE "approval_delegates" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_delegates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_delegates_fromUserId_spaceId_isActive_idx" ON "approval_delegates"("fromUserId", "spaceId", "isActive");
