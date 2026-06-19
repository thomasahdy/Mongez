-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Phase 2 — Workflow Engine + Usage Metering
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- CreateTable: WorkflowDefinition
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowStep
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approverRole" TEXT,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "requiresAll" BOOLEAN NOT NULL DEFAULT true,
    "timeoutHours" INTEGER,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowInstance
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowAction
CREATE TABLE "workflow_actions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UsageRecord
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: WorkflowDefinition
CREATE INDEX "workflow_definitions_spaceId_idx" ON "workflow_definitions"("spaceId");
CREATE INDEX "workflow_definitions_isActive_idx" ON "workflow_definitions"("isActive");

-- CreateIndex: WorkflowStep
CREATE INDEX "workflow_steps_definitionId_idx" ON "workflow_steps"("definitionId");

-- CreateIndex: WorkflowInstance
CREATE INDEX "workflow_instances_definitionId_idx" ON "workflow_instances"("definitionId");
CREATE INDEX "workflow_instances_spaceId_idx" ON "workflow_instances"("spaceId");
CREATE INDEX "workflow_instances_entityType_entityId_idx" ON "workflow_instances"("entityType", "entityId");
CREATE INDEX "workflow_instances_requesterId_idx" ON "workflow_instances"("requesterId");
CREATE INDEX "workflow_instances_status_idx" ON "workflow_instances"("status");
CREATE INDEX "workflow_instances_createdAt_idx" ON "workflow_instances"("createdAt");

-- CreateIndex: WorkflowAction
CREATE INDEX "workflow_actions_instanceId_idx" ON "workflow_actions"("instanceId");
CREATE INDEX "workflow_actions_actorId_idx" ON "workflow_actions"("actorId");

-- CreateIndex: UsageRecord
CREATE INDEX "usage_records_spaceId_metric_recordedAt_idx" ON "usage_records"("spaceId", "metric", "recordedAt");

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Analytics — Materialized Views (refreshed hourly)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Materialized View: Task completion rate by department (weekly)
CREATE MATERIALIZED VIEW mv_task_completion_by_dept AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  d."spaceId",
  DATE_TRUNC('week', t."createdAt") AS week,
  COUNT(*)::int AS total_tasks,
  COUNT(*) FILTER (WHERE t.status = 'DONE')::int AS completed_tasks,
  ROUND(
    COUNT(*) FILTER (WHERE t.status = 'DONE')::numeric / NULLIF(COUNT(*), 0) * 100, 2
  ) AS completion_rate
FROM "tasks" t
JOIN "boards" b ON t."boardId" = b.id
JOIN "departments" d ON b."departmentId" = d.id
WHERE t."isArchived" = false
GROUP BY d.id, d.name, d."spaceId", DATE_TRUNC('week', t."createdAt");

CREATE UNIQUE INDEX mv_task_completion_by_dept_id
  ON mv_task_completion_by_dept (department_id, week);

-- Materialized View: Overdue tasks by assignee (uses task_assignments junction)
CREATE MATERIALIZED VIEW mv_overdue_by_assignee AS
SELECT
  ta."userId" AS assignee_id,
  u.name AS assignee_name,
  d."spaceId",
  COUNT(DISTINCT t.id)::int AS overdue_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - t."dueDate"))/3600) AS avg_overdue_hours
FROM "task_assignments" ta
JOIN "tasks" t ON ta."taskId" = t.id
JOIN "users" u ON ta."userId" = u.id
JOIN "boards" b ON t."boardId" = b.id
JOIN "departments" d ON b."departmentId" = d.id
WHERE t."dueDate" < NOW()
  AND t.status NOT IN ('DONE', 'CANCELLED')
  AND t."isArchived" = false
GROUP BY ta."userId", u.name, d."spaceId";

CREATE UNIQUE INDEX mv_overdue_by_assignee_id
  ON mv_overdue_by_assignee (assignee_id, "spaceId");

-- Materialized View: Approval SLA (time from creation to resolution)
CREATE MATERIALIZED VIEW mv_approval_sla AS
SELECT
  wi."spaceId",
  wi."definitionId",
  AVG(EXTRACT(EPOCH FROM (wi."resolvedAt" - wi."createdAt"))/3600) AS avg_hours_to_resolve,
  COUNT(*) FILTER (WHERE wi.status = 'APPROVED')::int AS approved_count,
  COUNT(*) FILTER (WHERE wi.status = 'REJECTED')::int AS rejected_count,
  DATE_TRUNC('month', wi."createdAt") AS month
FROM "workflow_instances" wi
WHERE wi."resolvedAt" IS NOT NULL
GROUP BY wi."spaceId", wi."definitionId", DATE_TRUNC('month', wi."createdAt");

CREATE UNIQUE INDEX mv_approval_sla_id
  ON mv_approval_sla ("spaceId", "definitionId", month);

-- Materialized View: AI usage by space (daily)
CREATE MATERIALIZED VIEW mv_ai_usage AS
SELECT
  "spaceId",
  DATE_TRUNC('day', "createdAt") AS day,
  COUNT(*)::int AS total_requests,
  SUM("tokensIn" + "tokensOut")::bigint AS total_tokens,
  AVG("latencyMs") AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_requests
FROM "ai_requests"
GROUP BY "spaceId", DATE_TRUNC('day', "createdAt");

CREATE UNIQUE INDEX mv_ai_usage_id
  ON mv_ai_usage ("spaceId", day);