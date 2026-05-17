/*
  Warnings:

  - A unique constraint covering the columns `[providerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "rewrittenQuery" TEXT,
    "finalResponse" TEXT,
    "modelUsed" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "ttftMs" INTEGER,
    "qualityScore" DOUBLE PRECISION,
    "userFeedback" INTEGER,
    "feedbackNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposed_actions" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_proposed_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_eval_results" (
    "id" TEXT NOT NULL,
    "traceId" TEXT,
    "evalType" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "details" JSONB,
    "promptVersion" TEXT,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_eval_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_traceId_key" ON "ai_requests"("traceId");

-- CreateIndex
CREATE INDEX "ai_requests_userId_idx" ON "ai_requests"("userId");

-- CreateIndex
CREATE INDEX "ai_requests_spaceId_idx" ON "ai_requests"("spaceId");

-- CreateIndex
CREATE INDEX "ai_requests_intent_idx" ON "ai_requests"("intent");

-- CreateIndex
CREATE INDEX "ai_requests_traceId_idx" ON "ai_requests"("traceId");

-- CreateIndex
CREATE INDEX "ai_requests_createdAt_idx" ON "ai_requests"("createdAt");

-- CreateIndex
CREATE INDEX "ai_proposed_actions_traceId_idx" ON "ai_proposed_actions"("traceId");

-- CreateIndex
CREATE INDEX "ai_proposed_actions_spaceId_idx" ON "ai_proposed_actions"("spaceId");

-- CreateIndex
CREATE INDEX "ai_proposed_actions_status_idx" ON "ai_proposed_actions"("status");

-- CreateIndex
CREATE INDEX "ai_eval_results_feature_idx" ON "ai_eval_results"("feature");

-- CreateIndex
CREATE INDEX "ai_eval_results_metricName_idx" ON "ai_eval_results"("metricName");

-- CreateIndex
CREATE INDEX "ai_eval_results_createdAt_idx" ON "ai_eval_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_providerId_key" ON "users"("providerId");

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposed_actions" ADD CONSTRAINT "ai_proposed_actions_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "ai_requests"("traceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposed_actions" ADD CONSTRAINT "ai_proposed_actions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
