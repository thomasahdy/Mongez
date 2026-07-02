import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { AIChatSessionRepository } from './repositories/ai-chat-session.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { Observable } from 'rxjs';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly requestRepo: AIRequestRepository,
    private readonly actionRepo: AIActionRepository,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
    private readonly chatSessionRepo: AIChatSessionRepository,
  ) {}

  async checkSpaceMembership(userId: string, spaceId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }
  }

  async chat(userId: string, dto: ChatDto) {
    if (dto.spaceId) {
      await this.checkSpaceMembership(userId, dto.spaceId);
    }
    return this.aiGateway.chat(userId, dto);
  }

  async chatStream(userId: string, dto: ChatDto): Promise<{ traceId: string; stream: Observable<string> }> {
    if (dto.spaceId) {
      await this.checkSpaceMembership(userId, dto.spaceId);
    }
    return this.aiGateway.streamChat(userId, dto);
  }

  async analyzeRisk(userId: string, dto: RiskAnalysisDto) {
    await this.checkSpaceMembership(userId, dto.spaceId);
    return this.aiGateway.analyzeRisk(userId, dto);
  }

  async generateReport(userId: string, dto: ReportDto) {
    await this.checkSpaceMembership(userId, dto.spaceId);
    return this.aiGateway.generateReport(userId, dto);
  }

  /**
   * GET /ai/context — lightweight workspace context for the AI assistant sidebar.
   * Returns recent active tasks + board list scoped to the space and verified membership.
   */
  async getContext(spaceId: string, userId: string): Promise<{
    tasks: { id: string; title: string; status: string; priority: string; dueDate: Date | null }[];
    boards: { id: string; name: string }[];
  }> {
    await this.checkSpaceMembership(userId, spaceId);

    const [tasks, boards] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          board: { department: { spaceId } },
          isArchived: false,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
      }),
      this.prisma.board.findMany({
        where: {
          department: { spaceId },
          isArchived: false,
          deletedAt: null,
        },
        select: { id: true, name: true },
      }),
    ]);

    return { tasks, boards };
  }

  async getDashboard(spaceId: string, userId: string) {
    await this.checkSpaceMembership(userId, spaceId);

    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000);

    // 1. DYNAMIC USER WORKLOAD CAPACITY CALCULATION
    // Query done tasks completed in the last 30 days
    const completedTasks = await this.prisma.task.findMany({
      where: {
        board: { department: { spaceId } },
        isArchived: false,
        status: 'DONE',
        updatedAt: { gte: thirtyDaysAgo },
      },
      include: {
        assignments: true,
      },
    });

    const userCompletions: Record<string, number> = {};
    for (const t of completedTasks) {
      for (const a of t.assignments) {
        userCompletions[a.userId] = (userCompletions[a.userId] || 0) + 1;
      }
    }

    // Dynamic capacity per user: completions per week * 1.5. Minimum fallback = 5 tasks.
    const getUserCapacity = (uId: string): number => {
      const completions = userCompletions[uId] || 0;
      const weeklyAvg = completions / 4;
      const computed = Math.round(weeklyAvg * 1.5);
      return computed >= 2 ? computed : 5; // fallback to 5
    };

    // 2. QUERY METRICS DATA
    // Tasks: open, overdue, blocked
    const openTasks = await this.prisma.task.findMany({
      where: {
        board: { department: { spaceId } },
        isArchived: false,
        NOT: { status: { in: ['DONE', 'CANCELLED'] } },
      },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        board: { select: { name: true } },
      },
    });

    let overdueCount = 0;
    let blockedCount = 0;
    let upcomingDeadlinesCount = 0;
    let unassignedCount = 0;

    const userTaskCounts: Record<string, { name: string; count: number; capacity: number }> = {};

    for (const task of openTasks) {
      if (task.status === 'BLOCKED') {
        blockedCount++;
      }

      if (task.dueDate) {
        const dDate = new Date(task.dueDate);
        if (dDate < now) {
          overdueCount++;
        } else if (dDate <= threeDaysFromNow) {
          upcomingDeadlinesCount++;
        }
      }

      if (task.assignments.length === 0) {
        unassignedCount++;
      } else {
        for (const assign of task.assignments) {
          const uId = assign.userId;
          if (!userTaskCounts[uId]) {
            userTaskCounts[uId] = {
              name: assign.user.name,
              count: 0,
              capacity: getUserCapacity(uId),
            };
          }
          userTaskCounts[uId].count++;
        }
      }
    }

    const overloadedUsers = Object.values(userTaskCounts).filter(
      (u) => u.count > u.capacity,
    );

    // Pending Approvals (Workflow Instances)
    const pendingWorkflowCount = await this.prisma.workflowInstance.count({
      where: { spaceId, status: 'PENDING' },
    });

    const pendingWorkflowInstances = await this.prisma.workflowInstance.findMany({
      where: { spaceId, status: 'PENDING' },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const staleWorkflowCount = await this.prisma.workflowInstance.count({
      where: {
        spaceId,
        status: 'PENDING',
        startedAt: { lt: fortyEightHoursAgo },
      },
    });

    // Meeting actions waiting review
    const pendingMeetingActionsCount = await this.prisma.proposedTask.count({
      where: { spaceId, status: 'PENDING' },
    });

    // High risk projects (boards with blocked or overdue tasks)
    const highRiskBoards = await this.prisma.board.findMany({
      where: {
        department: { spaceId },
        isArchived: false,
        tasks: {
          some: {
            isArchived: false,
            NOT: { status: { in: ['DONE', 'CANCELLED'] } },
            OR: [
              { status: 'BLOCKED' },
              { dueDate: { lt: now } },
            ],
          },
        },
      },
      select: { id: true, name: true },
    });

    // 3. COMPILE EXECUTIVE FEED (Insights with timestamps)
    const insights: Array<{ id: string; timestamp: Date; severity: 'high' | 'warning' | 'info'; message: string }> = [];

    // Stuck workflows
    const staleInstances = await this.prisma.workflowInstance.findMany({
      where: {
        spaceId,
        status: 'PENDING',
        startedAt: { lt: fortyEightHoursAgo },
      },
      select: { id: true, entityType: true, startedAt: true },
      take: 3,
    });
    for (const inst of staleInstances) {
      insights.push({
        id: `stale-wf-${inst.id}`,
        timestamp: inst.startedAt,
        severity: 'high',
        message: `Workflow approval for ${inst.entityType.toLowerCase()} is stuck for over 48 hours.`,
      });
    }

    // Overloaded assignees
    for (const user of overloadedUsers) {
      insights.push({
        id: `overload-${user.name}-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        message: `${user.name} exceeded workload capacity threshold (${user.count}/${user.capacity} tasks).`,
      });
    }

    // High risk boards
    for (const b of highRiskBoards) {
      insights.push({
        id: `risk-board-${b.id}`,
        timestamp: new Date(),
        severity: 'high',
        message: `Board "${b.name}" is at high risk due to blocked or overdue tasks.`,
      });
    }

    // Upcoming deadlines
    if (upcomingDeadlinesCount > 0) {
      insights.push({
        id: `upcoming-${Date.now()}`,
        timestamp: new Date(),
        severity: 'info',
        message: `${upcomingDeadlinesCount} task(s) have deadlines approaching in the next 3 days.`,
      });
    }

    // Unassigned tasks
    if (unassignedCount > 0) {
      insights.push({
        id: `unassigned-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        message: `${unassignedCount} active task(s) are unassigned and need ownership.`,
      });
    }

    // Default if clean
    if (insights.length === 0) {
      insights.push({
        id: `clean-${Date.now()}`,
        timestamp: new Date(),
        severity: 'info',
        message: 'All workspace workflows and tasks are running nominally.',
      });
    }

    // Sort insights by timestamp desc
    insights.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 4. RETRIEVE RELATED LISTS
    // Pending AI Actions
    const pendingActions = await this.actionRepo.findPending(spaceId);

    // Stale or escalated approvals
    const approvals = pendingWorkflowInstances.map((w) => ({
      id: w.id,
      title: `${w.entityType.replace('_', ' ')} Approval`,
      entityId: w.entityId,
      status: w.status,
      startedAt: w.startedAt,
      isStale: w.startedAt < fortyEightHoursAgo,
    }));

    // Risks: Overdue or Blocked tasks details
    const risks = openTasks
      .filter((t) => t.status === 'BLOCKED' || (t.dueDate && new Date(t.dueDate) < now))
      .map((t) => ({
        id: t.id,
        identifier: t.identifier,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        boardName: t.board.name,
      }))
      .slice(0, 10);

    // Recent Decisions
    const recentDecisions = await this.prisma.decisionRecord.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Meeting Intelligence
    const meetings = await this.prisma.meeting.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { proposedTasks: true } },
      },
      take: 5,
    });

    const meetingIntelligence = meetings.map((m) => ({
      id: m.id,
      title: m.title,
      createdAt: m.createdAt,
      proposedTasksCount: m._count.proposedTasks,
      summary: m.summary,
    }));

    return {
      metrics: {
        openTasks: openTasks.length,
        overdueTasks: overdueCount,
        blockedTasks: blockedCount,
        pendingApprovals: pendingWorkflowCount,
        staleApprovals: staleWorkflowCount,
        highRiskProjects: highRiskBoards.length,
        overloadedMembers: overloadedUsers.length,
        upcomingDeadlines: upcomingDeadlinesCount,
        meetingActionsWaitingReview: pendingMeetingActionsCount,
      },
      insights: insights.slice(0, 10),
      pendingActions,
      approvals,
      risks,
      recentDecisions,
      meetingIntelligence,
    };
  }

  async getPendingActions(spaceId: string, userId: string) {
    await this.checkSpaceMembership(userId, spaceId);
    return this.actionRepo.findPending(spaceId);
  }

  async checkActionReviewPermission(reviewerId: string, spaceId: string, actionId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_spaceId: { userId: reviewerId, spaceId } },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    const roleName = membership.role?.name?.toUpperCase() || '';
    const hasExplicitPerm = membership.role?.permissions?.some(
      (rp) => rp.permission?.action === 'approve' && rp.permission?.resource === 'ai_action',
    ) || false;

    const isAuthorized = ['OWNER', 'ADMIN', 'HEAD'].includes(roleName) || hasExplicitPerm;
    if (!isAuthorized) {
      this.logger.warn(`Privilege escalation attempt: user ${reviewerId} (role: ${roleName}) tried to resolve AIProposedAction ${actionId}`);
      throw new ForbiddenException('You do not have permission to approve/reject AI proposed actions.');
    }
  }

  async approveAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    const action = await this.actionRepo.findById(actionId);
    if (!action) throw new NotFoundException(`AI proposed action ${actionId} not found`);
    await this.checkActionReviewPermission(reviewerId, action.spaceId, actionId);
    return this.aiGateway.executeApprovedAction(actionId, reviewerId);
  }

  async rejectAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    const action = await this.actionRepo.findById(actionId);
    if (!action) throw new NotFoundException(`AI proposed action ${actionId} not found`);
    await this.checkActionReviewPermission(reviewerId, action.spaceId, actionId);
    return this.actionRepo.reject(actionId, reviewerId, dto.reviewNote);
  }

  async submitFeedback(dto: FeedbackDto, userId: string) {
    const existing = await this.requestRepo.findByTraceId(dto.traceId);
    if (!existing) throw new NotFoundException(`AI request with traceId ${dto.traceId} not found`);
    await this.checkSpaceMembership(userId, existing.spaceId);

    let numericRating: number;
    if (dto.rating === 'positive') {
      numericRating = 1;
    } else if (dto.rating === 'negative') {
      numericRating = -1;
    } else {
      numericRating = Number(dto.rating);
    }

    return this.requestRepo.update(dto.traceId, {
      userFeedback: numericRating,
      feedbackNote: dto.note,
    });
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    return this.requestRepo.findByUser(userId, page, limit);
  }

  async listChatSessions(userId: string) {
    return this.chatSessionRepo.findByUser(userId);
  }

  async getChatSession(id: string, userId: string) {
    const session = await this.chatSessionRepo.findById(id);
    if (!session) {
      throw new NotFoundException(`Chat session ${id} not found`);
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this chat session.');
    }
    return session;
  }

  async createChatSession(userId: string, data: { id?: string; title: string; context?: any; messages: any[] }) {
    return this.chatSessionRepo.create(userId, data);
  }

  async updateChatSession(id: string, userId: string, data: { title?: string; context?: any; messages?: any[] }) {
    await this.getChatSession(id, userId);
    return this.chatSessionRepo.update(id, userId, data);
  }

  async deleteChatSession(id: string, userId: string) {
    await this.getChatSession(id, userId);
    return this.chatSessionRepo.delete(id, userId);
  }

  async invalidateCacheForSpace(spaceId: string) {
    this.logger.log(`Invalidating AI cache for space ${spaceId}`);
    await Promise.all([
      this.cache.delPattern(`ai:chat:${spaceId}:*`),
      this.cache.delPattern(`ai:risk:${spaceId}:*`),
    ]);
  }
}
