-- Phase 2.4: Analytics materialized views
-- These views aggregate operational data for dashboards without expensive runtime queries.
-- Refreshed hourly by AnalyticsRefreshService via REFRESH MATERIALIZED VIEW CONCURRENTLY.

DROP MATERIALIZED VIEW IF EXISTS mv_task_completion_by_dept CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_overdue_by_assignee CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_approval_sla CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_ai_usage CASCADE;

-- View: Task completion rate by department (weekly buckets)
CREATE MATERIALIZED VIEW mv_task_completion_by_dept AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  d."spaceId",
  DATE_TRUNC('week', t."createdAt") AS week,
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE t.status = 'DONE') AS completed_tasks,
  ROUND(
    COUNT(*) FILTER (WHERE t.status = 'DONE')::numeric / NULLIF(COUNT(*), 0) * 100, 2
  ) AS completion_rate
FROM tasks t
JOIN boards b ON t."boardId" = b.id
JOIN departments d ON b."departmentId" = d.id
WHERE t."isArchived" = false
GROUP BY d.id, d.name, d."spaceId", DATE_TRUNC('week', t."createdAt");

-- View: Overdue tasks by assignee
CREATE MATERIALIZED VIEW mv_overdue_by_assignee AS
SELECT
  ta."userId" AS "assigneeId",
  u.name AS assignee_name,
  d."spaceId",
  COUNT(*) AS overdue_count,
  AVG(NOW() - t."dueDate") AS avg_overdue_duration
FROM tasks t
JOIN task_assignments ta ON ta."taskId" = t.id
JOIN users u ON ta."userId" = u.id
JOIN boards b ON t."boardId" = b.id
JOIN departments d ON b."departmentId" = d.id
WHERE t."dueDate" < NOW()
  AND t.status NOT IN ('DONE', 'CANCELLED')
  AND t."isArchived" = false
GROUP BY ta."userId", u.name, d."spaceId";

-- View: Approval SLA (time from creation to resolution)
CREATE MATERIALIZED VIEW mv_approval_sla AS
SELECT
  wi."spaceId",
  wi."definitionId",
  AVG(EXTRACT(EPOCH FROM (wi."resolvedAt" - wi."createdAt")) / 3600) AS avg_hours_to_resolve,
  COUNT(*) FILTER (WHERE wi.status = 'APPROVED') AS approved_count,
  COUNT(*) FILTER (WHERE wi.status = 'REJECTED') AS rejected_count,
  DATE_TRUNC('month', wi."createdAt") AS month
FROM workflow_instances wi
WHERE wi."resolvedAt" IS NOT NULL
GROUP BY wi."spaceId", wi."definitionId", DATE_TRUNC('month', wi."createdAt");

-- View: AI usage by space (daily buckets)
CREATE MATERIALIZED VIEW mv_ai_usage AS
SELECT
  "spaceId",
  DATE_TRUNC('day', "createdAt") AS day,
  COUNT(*) AS total_requests,
  COALESCE(SUM("tokensIn" + "tokensOut"), 0) AS total_tokens,
  AVG("latencyMs") AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_requests
FROM ai_requests
GROUP BY "spaceId", DATE_TRUNC('day', "createdAt");

-- Unique indexes required for CONCURRENTLY refresh (must come AFTER view creation)
CREATE UNIQUE INDEX mv_task_completion_by_dept_uidx
  ON mv_task_completion_by_dept (department_id, week);

CREATE UNIQUE INDEX mv_overdue_by_assignee_uidx
  ON mv_overdue_by_assignee ("assigneeId", "spaceId");

CREATE UNIQUE INDEX mv_approval_sla_uidx
  ON mv_approval_sla ("spaceId", "definitionId", month);

CREATE UNIQUE INDEX mv_ai_usage_uidx
  ON mv_ai_usage ("spaceId", day);