import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Exposes structured data from the Mongez database for the Python AI service.
 * These methods are called by the AI data provider controller (/internal/ai/...).
 * Phase 1: Returns live data. SQL execution endpoint implemented in Phase 4.
 */
@Injectable()
export class AIDataProviderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns tasks within a space with assignees, due dates, status, and priority.
   * The AI uses this for risk analysis and report generation.
   */
  async getTasksBySpace(spaceId: string, boardId?: string) {
    const where: any = {
      board: { department: { spaceId } },
      isArchived: false,
    };
    if (boardId) where.boardId = boardId;

    return this.prisma.task.findMany({
      where,
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        board: { select: { id: true, name: true } },
        _count: { select: { comments: true, subtasks: true, attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Returns a single task details by ID.
   */
  async getTaskById(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        board: { select: { id: true, name: true } },
        _count: { select: { comments: true, subtasks: true, attachments: true } },
      },
    });
  }


  /**
   * Returns all comments for a specific task.
   * Used for per-task context retrieval.
   */
  async getCommentsByTask(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Returns all comments for all tasks in a space.
   * Used by the RAG indexer for bulk ingestion.
   */
  async getCommentsBySpace(spaceId: string) {
    const userSelect = { id: true, name: true };
    return this.prisma.comment.findMany({
      where: {
        task: { board: { department: { spaceId } } },
      },
      include: { author: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  /**
   * Returns recent audit log entries for a space.
   * Scoped by joining through users → memberships → space.
   */
  async getAuditLogBySpace(spaceId: string, limit = 200) {
    return this.prisma.auditLog.findMany({
      where: {
        user: {
          memberships: {
            some: { spaceId },
          },
        },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        diff: true,
        timestamp: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Returns a JSON representation of the relevant schema tables.
   * Used by the Text-to-SQL agent to understand available columns.
   */
  getSchemaDescription() {
    return {
      tables: [
        {
          name: 'tasks',
          columns: [
            'id', 'identifier', 'title', 'description', 'boardId', 'columnId',
            'status', 'priority', 'type', 'estimatedHours', 'percentDone',
            'dueDate', 'startDate', 'parentId', 'tags', 'isArchived',
            'createdById', 'createdAt', 'updatedAt',
          ],
          enums: {
            status: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'],
            priority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'],
          },
        },
        {
          name: 'users',
          columns: ['id', 'email', 'name', 'status', 'createdAt'],
        },
        {
          name: 'task_assignments',
          columns: ['taskId', 'userId', 'assignedAt'],
        },
        {
          name: 'comments',
          columns: ['id', 'taskId', 'userId', 'content', 'createdAt'],
        },
        {
          name: 'boards',
          columns: ['id', 'name', 'departmentId', 'type', 'isArchived', 'createdAt'],
        },
        {
          name: 'departments',
          columns: ['id', 'name', 'spaceId'],
        },
        {
          name: 'spaces',
          columns: ['id', 'name', 'description', 'isPublic', 'createdAt'],
        },
        {
          name: 'audit_logs',
          columns: ['id', 'userId', 'action', 'entityType', 'entityId', 'diff', 'timestamp'],
        },
      ],
      tenantKey: 'spaceId (via departments.spaceId for tasks/boards)',
      note: 'All AI queries MUST include a WHERE clause scoped to the user\'s spaceId',
    };
  }

  async updateAIRequest(traceId: string, data: any) {
    const updates: any = {};
    if (data.intent) updates.intent = data.intent;
    if (data.rewrittenQuery) updates.rewrittenQuery = data.rewrittenQuery;
    if (data.finalResponse) updates.finalResponse = data.finalResponse;
    if (data.modelUsed) updates.modelUsed = data.modelUsed;
    if (data.tokensIn !== undefined) updates.tokensIn = data.tokensIn;
    if (data.tokensOut !== undefined) updates.tokensOut = data.tokensOut;
    if (data.latencyMs !== undefined) updates.latencyMs = data.latencyMs;
    if (data.status) updates.status = data.status;
    if (data.errorMessage) updates.errorMessage = data.errorMessage;

    return this.prisma.aiRequest.update({
      where: { traceId },
      data: updates,
    });
  }
}
