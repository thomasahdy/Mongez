import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';

export interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  completionRate: number;
  overduePercent: number;
  approvalSla: number;
  aiRiskCount: number;
}

export interface AnalyticsPeriod {
  from: Date;
  to: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.REPORTS) private readonly reportsQueue: Queue,
  ) { }

  /**
   * Weighted project health score (0-100) with letter grade.
   * 40% completion rate, 30% overdue penalty, 20% approval SLA, 10% AI risk count.
   */
  async getHealthScore(spaceId: string): Promise<HealthScore> {
    const [completionRate, overduePercent, approvalSla, aiRiskCount] = await Promise.all([
      this.getCompletionRate(spaceId),
      this.getOverduePercent(spaceId),
      this.getApprovalSla(spaceId),
      this.getActiveRiskCount(spaceId),
    ]);

    const score = Math.round(
      completionRate * 0.4 +
      Math.max(0, 100 - overduePercent * 2) * 0.3 +
      Math.min(100, 100 - (approvalSla / 72) * 100) * 0.2 +
      Math.max(0, 100 - aiRiskCount * 10) * 0.1,
    );

    return {
      score,
      grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
      completionRate,
      overduePercent,
      approvalSla,
      aiRiskCount,
    };
  }

  /**
   * High-level KPI overview for a space dashboard.
   */
  async getOverview(spaceId: string) {
    const [healthScore, taskSummary, memberCount, pendingApprovals, aiUsage] = await Promise.all([
      this.getHealthScore(spaceId),
      this.getTaskSummary(spaceId),
      this.prisma.membership.count({ where: { spaceId } }),
      this.prisma.workflowInstance.count({
        where: { spaceId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      this.getAiUsageSummary(spaceId, this.weekPeriod()),
    ]);

    return {
      healthScore,
      taskSummary,
      memberCount,
      pendingApprovals,
      aiUsage,
    };
  }

  /**
   * Task velocity & completion from the materialized view (weekly buckets) or priority breakdown.
   */
  async getTaskMetrics(spaceId: string, period: AnalyticsPeriod, groupBy?: string) {
    if (groupBy === 'priority') {
      const grouped = await this.prisma.task.groupBy({
        by: ['priority'],
        where: { board: { department: { spaceId } }, isArchived: false },
        _count: { _all: true },
      });
      return { breakdown: { data: { items: grouped.map(g => ({ label: g.priority, count: g._count._all })) } } };
    }

    const tasks = await this.prisma.task.findMany({
      where: { board: { department: { spaceId } }, isArchived: false, createdAt: { gte: period.from, lte: period.to } },
      select: { status: true, createdAt: true },
    });

    // Determine formatting based on the period span
    const diffDays = (period.to.getTime() - period.from.getTime()) / (1000 * 3600 * 24);
    const bucketType = diffDays <= 31 ? 'day' : diffDays <= 90 ? 'week' : 'month';

    const buckets: Record<string, { label: string; created: number; completed: number }> = {};

    for (const task of tasks) {
      const d = task.createdAt;
      let label = '';
      if (bucketType === 'day') {
        label = d.toISOString().split('T')[0];
      } else if (bucketType === 'week') {
        const firstDay = new Date(d.setDate(d.getDate() - d.getDay()));
        label = firstDay.toISOString().split('T')[0];
      } else {
        label = d.toISOString().substring(0, 7); // YYYY-MM
      }

      if (!buckets[label]) {
        buckets[label] = { label, created: 0, completed: 0 };
      }
      buckets[label].created += 1;
      if (task.status === 'DONE') {
        buckets[label].completed += 1;
      }
    }

    const rows = Object.values(buckets).sort((a, b) => a.label.localeCompare(b.label));

    // For overdue assignees, also do live query
    const overdueTasks = await this.prisma.taskAssignment.groupBy({
      by: ['userId'],
      where: {
        task: {
          board: { department: { spaceId } },
          status: { notIn: ['DONE', 'CANCELLED'] },
          dueDate: { lt: new Date() },
          isArchived: false,
        }
      },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    });
    
    // We can just return the raw grouped data for now; the chart can process it.
    const overdue = overdueTasks.map(t => ({ assigneeId: t.userId, overdue_count: t._count._all }));

    return { weeklyCompletion: rows.map(r => ({ ...r, week: r.label, month: r.label })), topOverdueAssignees: overdue };
  }

  /**
   * Executive summary metrics.
   */
  async getExecutiveMetrics(spaceId: string) {
    const overview = await this.getOverview(spaceId);
    return overview; // Simplest implementation using overview
  }

  /**
   * Workflow analytics metrics.
   */
  async getWorkflowAnalytics(spaceId: string, period: AnalyticsPeriod) {
    const data = await this.prisma.workflowInstance.groupBy({
      by: ['status'],
      where: { spaceId, createdAt: { gte: period.from, lte: period.to } },
      _count: { _all: true },
    });
    return data;
  }

  /**
   * Per-member performance (completion, overdue, approval activity).
   */
  async getTeamMetrics(spaceId: string, period: AnalyticsPeriod, role?: string) {
    // Ensure we have valid Date objects – fall back to a 30-day window if the
    // caller passes an invalid date (e.g. undefined period string from the frontend).
    const safeTo = period.to instanceof Date && !isNaN(period.to.getTime()) ? period.to : new Date();
    const safeFrom = period.from instanceof Date && !isNaN(period.from.getTime()) ? period.from : new Date(safeTo.getTime() - 30 * 24 * 3600 * 1000);

    const [overdue, approvals] = await Promise.all([
      // Cast avg_overdue_duration from interval → text so Prisma can deserialize it.
      this.prisma.$queryRaw<any[]>`
        SELECT
          "assigneeId",
          assignee_name,
          "spaceId",
          overdue_count,
          avg_overdue_duration::text AS avg_overdue_duration
        FROM mv_overdue_by_assignee
        WHERE "spaceId" = ${spaceId}
      `,
      this.prisma.workflowAction.groupBy({
        by: ['actorId'],
        where: {
          instance: { spaceId },
          createdAt: { gte: safeFrom, lte: safeTo },
        },
        _count: { _all: true },
      }),
    ]);

    const actorIds = approvals.map((a) => a.actorId);
    const users = actorIds.length
      ? await this.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, avatarUrl: true },
      })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const activity = approvals.map((a) => ({
      ...userMap.get(a.actorId),
      actions: a._count._all,
    }));

    return {
      overdueByAssignee: overdue,
      approvalActivity: activity,
      members: role ? activity : undefined, // Compatibility with frontend role filtering mapping
    };
  }

  /**
   * Approval SLA from materialized view (monthly buckets).
   */
  async getApprovalMetrics(spaceId: string, period: AnalyticsPeriod) {
    return this.prisma.$queryRaw<any[]>`
      SELECT * FROM mv_approval_sla
      WHERE "spaceId" = ${spaceId}
        AND month BETWEEN ${period.from} AND ${period.to}
      ORDER BY month DESC
    `;
  }

  /**
   * AI usage metrics and cost estimate from materialized view.
   */
  async getAiMetrics(spaceId: string, period: AnalyticsPeriod, costPer1kTokens = 0.005) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM mv_ai_usage
      WHERE "spaceId" = ${spaceId}
        AND day BETWEEN ${period.from} AND ${period.to}
      ORDER BY day DESC
    `;

    const totalTokens = rows.reduce((sum, r) => sum + Number(r.total_tokens ?? 0), 0);
    const estimatedCost = (totalTokens / 1000) * costPer1kTokens;

    return {
      dailyUsage: rows,
      totalTokens,
      estimatedCost: Number(estimatedCost.toFixed(4)),
    };
  }

  /**
   * Queue raw task data export (CSV) for a space.
   */
  async queueExportData(spaceId: string, userId: string) {
    await this.reportsQueue.add(JOB_NAMES.GENERATE_REPORT, {
      spaceId,
      userId,
      format: 'csv',
      type: 'task_export',
    });
    return { status: 'queued', message: 'Export queued successfully' };
  }

  async getAdoptionInsights(spaceId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { spaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    const userIds = memberships.map(m => m.userId);
    if (!userIds.length) return [];

    // Batch fetch latest activities (Postgres DISTINCT ON would be ideal, but we can just group or fetch in memory since we are only doing this once instead of N times)
    // Actually, easier to just do a raw SQL query for latest activity per user:
    const latestActivities = await this.prisma.$queryRaw<any[]>`
      SELECT "userId", MAX(timestamp) as last_active_at
      FROM user_activity
      WHERE "spaceId" = ${spaceId} AND "userId" = ANY(${userIds})
      GROUP BY "userId"
    `.catch(() => []);

    const activityMap = new Map(latestActivities.map(a => [a.userId, a.last_active_at]));

    const [workflowActions, workflowsCreated] = await Promise.all([
      this.prisma.workflowAction.groupBy({
        by: ['actorId'],
        where: { actorId: { in: userIds }, instance: { spaceId } },
        _count: { _all: true },
      }),
      this.prisma.workflowInstance.groupBy({
        by: ['requesterId'],
        where: { requesterId: { in: userIds }, spaceId },
        _count: { _all: true },
      }),
    ]);

    const actionsMap = new Map(workflowActions.map(a => [a.actorId, a._count._all]));
    const createdMap = new Map(workflowsCreated.map(w => [w.requesterId, w._count._all]));

    const thirtyDaysAgo = new Date().getTime() - 30 * 24 * 3600 * 1000;

    return memberships.map(member => {
      const lastActiveAt = activityMap.get(member.userId) || null;
      return {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        lastActiveAt,
        workflowActionsCount: actionsMap.get(member.userId) || 0,
        workflowsCreatedCount: createdMap.get(member.userId) || 0,
        isInactive: lastActiveAt ? new Date(lastActiveAt as any).getTime() < thirtyDaysAgo : true,
      };
    });
  }

  /**
   * Cumulative flow diagram data.
   * Without daily snapshots, we estimate by tracking task created vs completed dates.
   */
  async getFlowMetrics(spaceId: string, period: AnalyticsPeriod) {
    const tasks = await this.prisma.task.findMany({
      where: { board: { department: { spaceId } }, isArchived: false, createdAt: { gte: period.from } },
      select: { status: true, createdAt: true, updatedAt: true },
    });

    const flowData: Record<string, { todo: number; progress: number; done: number }> = {};
    
    // Create a bucket for each day in the period
    let current = new Date(period.from);
    while (current <= period.to) {
      const dayStr = current.toISOString().split('T')[0];
      flowData[dayStr] = { todo: 0, progress: 0, done: 0 };
      current.setDate(current.getDate() + 1);
    }

    for (const task of tasks) {
      const createdStr = task.createdAt.toISOString().split('T')[0];
      if (flowData[createdStr]) {
        if (task.status === 'DONE') {
          flowData[createdStr].done += 1;
        } else if (task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') {
          flowData[createdStr].progress += 1;
        } else {
          flowData[createdStr].todo += 1;
        }
      }
    }

    return {
      data: {
        items: Object.entries(flowData).map(([day, counts]) => ({
          day,
          ...counts,
        })),
      },
    };
  }

  /**
   * Top performers based on completed tasks.
   */
  async getTopPerformers(spaceId: string) {
    const completedTasks = await this.prisma.taskAssignment.groupBy({
      by: ['userId'],
      where: {
        task: {
          board: { department: { spaceId } },
          status: 'DONE',
        },
      },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 4,
    });

    if (!completedTasks.length) return { data: { items: [] } };

    const users = await this.prisma.user.findMany({
      where: { id: { in: completedTasks.map(t => t.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    });
    
    const userMap = new Map(users.map(u => [u.id, u]));
    const colors = ['#10b981', '#00a8e8', '#e74c3c', '#f39c12'];

    const items = completedTasks.map((t, idx) => {
      const u = userMap.get(t.userId);
      const initials = u?.name ? u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
      return {
        id: t.userId,
        name: u?.name || 'Unknown',
        initials,
        color: colors[idx % colors.length],
        tasks: t._count._all,
      };
    });

    return { data: { items } };
  }

  /**
   * Generates textual insights for the dashboard.
   */
  async getDashboardAiInsights(spaceId: string) {
    const health = await this.getHealthScore(spaceId);
    const insights: any[] = [];

    if (health.completionRate > 50) {
      insights.push({
        id: "velocity",
        icon: "fa-arrow-trend-up",
        iconColor: "text-sky-500",
        title: "Velocity is High",
        description: `The workspace has an excellent completion rate of ${health.completionRate}%. Keep up the good work!`,
      });
    }

    if (health.overduePercent > 20) {
      insights.push({
        id: "bottleneck",
        icon: "fa-triangle-exclamation",
        iconColor: "text-amber-500",
        title: "High Overdue Tasks",
        description: `${health.overduePercent}% of tasks are overdue. Consider redistributing the workload.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "steady",
        icon: "fa-check-circle",
        iconColor: "text-emerald-500",
        title: "Steady Progress",
        description: "The workspace is operating normally with no critical bottlenecks detected.",
      });
    }

    return { data: { items: insights } };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async getCompletionRate(spaceId: string): Promise<number> {
    const [total, done] = await Promise.all([
      this.prisma.task.count({
        where: { board: { department: { spaceId } }, isArchived: false },
      }),
      this.prisma.task.count({
        where: { board: { department: { spaceId } }, isArchived: false, status: 'DONE' },
      }),
    ]);
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }

  private async getOverduePercent(spaceId: string): Promise<number> {
    const [total, overdue] = await Promise.all([
      this.prisma.task.count({
        where: { board: { department: { spaceId } }, isArchived: false },
      }),
      this.prisma.task.count({
        where: {
          board: { department: { spaceId } },
          isArchived: false,
          dueDate: { lt: new Date() },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
    ]);
    return total === 0 ? 0 : Math.round((overdue / total) * 100);
  }

  private async getApprovalSla(spaceId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600), 0)::float AS avg_hours
      FROM workflow_instances
      WHERE "spaceId" = ${spaceId} AND "resolvedAt" IS NOT NULL
    `;
    return Number(result[0]?.avg_hours ?? 0);
  }

  private async getActiveRiskCount(spaceId: string): Promise<number> {
    // AI risk scans that surfaced proposed actions still awaiting review
    try {
      return await this.prisma.aiProposedAction.count({
        where: {
          spaceId,
          status: 'PENDING',
          aiRequest: { intent: 'risk' },
        },
      });
    } catch {
      return 0;
    }
  }

  private async getTaskSummary(spaceId: string) {
    const statusGroups = await this.prisma.task.groupBy({
      by: ['status'],
      where: { board: { department: { spaceId } }, isArchived: false },
      _count: { _all: true },
    });

    return statusGroups.map((g) => ({ status: g.status, count: g._count._all }));
  }

  private async getAiUsageSummary(spaceId: string, period: AnalyticsPeriod) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(SUM(total_requests), 0)::int AS requests,
        COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
        COALESCE(AVG(avg_latency_ms), 0)::float AS latency
      FROM mv_ai_usage
      WHERE "spaceId" = ${spaceId} AND day BETWEEN ${period.from} AND ${period.to}
    `;
    return rows[0] ?? { requests: 0, tokens: 0, latency: 0 };
  }

  private weekPeriod(): AnalyticsPeriod {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from, to };
  }

  private monthPeriod(): AnalyticsPeriod {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    return { from, to };
  }
}