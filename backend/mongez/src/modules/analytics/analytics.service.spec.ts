import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      task: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      membership: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      workflowInstance: {
        count: jest.fn(),
      },
      workflowAction: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      userActivity: {
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      aiProposedAction: {
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as any;

    service = new AnalyticsService(prisma);
  });

  describe('getHealthScore()', () => {
    it('should compute project health score based on weighted inputs', async () => {
      // 1. completion rate: done = 8, total = 10 -> 80%
      (prisma.task.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // done

      // 2. overdue rate: total = 10, overdue = 2 -> 20%
      (prisma.task.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2); // overdue

      // 3. SLA: avg raw resolved duration: 36 hours
      prisma.$queryRaw.mockResolvedValue([{ avg_hours: 36 }]);

      // 4. AI Risks count: 1 pending risk
      prisma.aiProposedAction.count.mockResolvedValue(1);

      const result = await service.getHealthScore('space-1');

      // Math:
      // completionRate = 80 -> weight 40% = 32
      // overduePercent = 20 -> Max(0, 100 - 40) = 60 -> weight 30% = 18
      // approvalSla = 36 -> Min(100, 100 - (36/72)*100) = 50 -> weight 20% = 10
      // aiRiskCount = 1 -> Max(0, 100 - 10) = 90 -> weight 10% = 9
      // score = 32 + 18 + 10 + 9 = 69
      expect(result).toEqual({
        score: 69,
        grade: 'B',
        completionRate: 80,
        overduePercent: 20,
        approvalSla: 36,
        aiRiskCount: 1,
      });
    });

    it('should handle zero tasks / zero metrics gracefully', async () => {
      (prisma.task.count as jest.Mock).mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValue([{ avg_hours: 0 }]);
      prisma.aiProposedAction.count.mockResolvedValue(0);

      const result = await service.getHealthScore('space-1');

      // completionRate = 100 -> weight 40% = 40
      // overduePercent = 0 -> weight 30% = 30
      // approvalSla = 0 -> weight 20% = 20
      // aiRiskCount = 0 -> weight 10% = 10
      // score = 100
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });
  });

  describe('getOverview()', () => {
    it('should aggregate overview statistics for a space', async () => {
      // Mock health score metrics
      (prisma.task.count as jest.Mock).mockResolvedValue(0);
      prisma.$queryRaw.mockResolvedValue([{ avg_hours: 0 }]);
      prisma.aiProposedAction.count.mockResolvedValue(0);

      // Mock other endpoints
      prisma.membership.count.mockResolvedValue(5);
      prisma.workflowInstance.count.mockResolvedValue(2);
      prisma.task.groupBy.mockResolvedValue([
        { status: 'TODO', _count: { _all: 3 } },
        { status: 'DONE', _count: { _all: 2 } },
      ] as any);

      // Mock AI metrics queryRaw for weekPeriod
      prisma.$queryRaw.mockResolvedValue([{ requests: 10, tokens: 5000, latency: 150 }]);

      const overview = await service.getOverview('space-1');

      expect(overview).toHaveProperty('healthScore');
      expect(overview.memberCount).toBe(5);
      expect(overview.pendingApprovals).toBe(2);
      expect(overview.taskSummary).toEqual([
        { status: 'TODO', count: 3 },
        { status: 'DONE', count: 2 },
      ]);
    });
  });

  describe('getTaskMetrics()', () => {
    it('should fetch weekly task metrics and overdue count from views', async () => {
      const mockWeekly = [{ week: '2026-06-20', count: 5 }];
      const mockOverdue = [{ assigneeId: 'user-1', overdue_count: 2 }];

      prisma.$queryRaw
        .mockResolvedValueOnce(mockWeekly)
        .mockResolvedValueOnce(mockOverdue);

      const period = { from: new Date(), to: new Date() };
      const result = await service.getTaskMetrics('space-1', period);

      expect(result.weeklyCompletion).toEqual(mockWeekly);
      expect(result.topOverdueAssignees).toEqual(mockOverdue);
    });
  });

  describe('getTeamMetrics()', () => {
    it('should fetch member activity metrics for approvals and overdue tasks', async () => {
      const mockOverdue = [{ assigneeId: 'user-1', overdue_count: 2 }];
      const mockApprovals = [{ actorId: 'user-1', _count: { _all: 8 } }];

      prisma.$queryRaw.mockResolvedValue(mockOverdue);
      prisma.workflowAction.groupBy.mockResolvedValue(mockApprovals as any);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'John Doe', avatarUrl: null },
      ] as any);

      const period = { from: new Date(), to: new Date() };
      const result = await service.getTeamMetrics('space-1', period);

      expect(result.overdueByAssignee).toEqual(mockOverdue);
      expect(result.approvalActivity).toEqual([
        { id: 'user-1', name: 'John Doe', avatarUrl: null, actions: 8 },
      ]);
    });
  });

  describe('getAdoptionInsights()', () => {
    it('should detect inactive users and track feature usage', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'user-1', user: { name: 'John Doe', email: 'john@example.com', avatarUrl: null } },
        { userId: 'user-2', user: { name: 'Jane Doe', email: 'jane@example.com', avatarUrl: null } },
      ] as any);

      // User 1 has recent activity
      prisma.userActivity.findFirst
        .mockResolvedValueOnce({ timestamp: new Date() } as any) // user-1
        .mockResolvedValueOnce(null); // user-2 (no activity)

      prisma.workflowAction.count.mockResolvedValue(5);
      prisma.workflowInstance.count.mockResolvedValue(2);

      const insights = await service.getAdoptionInsights('space-1');

      expect(insights).toHaveLength(2);
      expect(insights[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          name: 'John Doe',
          isInactive: false,
          workflowActionsCount: 5,
          workflowsCreatedCount: 2,
        }),
      );
      expect(insights[1]).toEqual(
        expect.objectContaining({
          userId: 'user-2',
          name: 'Jane Doe',
          isInactive: true,
        }),
      );
    });
  });
});
