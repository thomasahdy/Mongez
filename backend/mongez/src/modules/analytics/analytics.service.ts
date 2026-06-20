import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
   * Task velocity & completion from the materialized view (weekly buckets).
   */
  async getTaskMetrics(spaceId: string, period: AnalyticsPeriod) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM mv_task_completion_by_dept
      WHERE "spaceId" = ${spaceId}
        AND week BETWEEN ${period.from} AND ${period.to}
      ORDER BY week DESC
    `;

    const overdue = await this.prisma.$queryRaw<any[]>`
      SELECT "assigneeId", assignee_name, overdue_count FROM mv_overdue_by_assignee
      WHERE "spaceId" = ${spaceId}
      ORDER BY overdue_count DESC
      LIMIT 10
    `;

    return { weeklyCompletion: rows, topOverdueAssignees: overdue };
  }

  /**
   * Per-member performance (completion, overdue, approval activity).
   */
  async getTeamMetrics(spaceId: string, period: AnalyticsPeriod) {
    const [overdue, approvals] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT * FROM mv_overdue_by_assignee WHERE "spaceId" = ${spaceId}
      `,
      this.prisma.workflowAction.groupBy({
        by: ['actorId'],
        where: {
          instance: { spaceId },
          createdAt: { gte: period.from, lte: period.to },
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

    return {
      overdueByAssignee: overdue,
      approvalActivity: approvals.map((a) => ({
        ...userMap.get(a.actorId),
        actions: a._count._all,
      })),
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
   * Export raw task data as CSV-able rows for a space.
   */
  async exportData(spaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { board: { department: { spaceId } } },
      select: {
        id: true,
        identifier: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        dueDate: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return tasks;
  }

  async getAdoptionInsights(spaceId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { spaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    const insights: any[] = [];

    for (const member of memberships) {
      const lastActivity = await this.prisma.userActivity.findFirst({
        where: { userId: member.userId, spaceId },
        orderBy: { timestamp: 'desc' },
      });

      const workflowActionsCount = await this.prisma.workflowAction.count({
        where: { actorId: member.userId, instance: { spaceId } },
      });

      const workflowsCreatedCount = await this.prisma.workflowInstance.count({
        where: { requesterId: member.userId, spaceId },
      });

      insights.push({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        lastActiveAt: lastActivity ? lastActivity.timestamp : null,
        workflowActionsCount,
        workflowsCreatedCount,
        isInactive: lastActivity
          ? (new Date().getTime() - new Date(lastActivity.timestamp).getTime()) > 30 * 24 * 3600 * 1000
          : true,
      });
    }

    return insights;
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