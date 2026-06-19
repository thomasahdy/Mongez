import { AIDataProviderService } from './ai-data-provider.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('AIDataProviderService', () => {
  let service: AIDataProviderService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      task: { findMany: jest.fn() },
      comment: { findMany: jest.fn() },
      auditLog: { findMany: jest.fn() },
    } as any;

    service = new AIDataProviderService(prisma);
  });

  // ─── getTasksBySpace ─────────────────────────────────────────

  describe('getTasksBySpace()', () => {
    it('UT-AI-DP-001: should query tasks scoped to space via board → department relation', async () => {
      const mockTasks = [{ id: 'task-1', title: 'Fix bug' }];
      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await service.getTasksBySpace('space-1');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            board: { department: { spaceId: 'space-1' } },
            isArchived: false,
          }),
        }),
      );
      expect(result).toEqual(mockTasks);
    });

    it('should additionally filter by boardId when provided', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTasksBySpace('space-1', 'board-specific');

      const query = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(query.where.boardId).toBe('board-specific');
    });

    it('should include assignments, board, and counts in response', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTasksBySpace('space-1');

      const query = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(query.include).toMatchObject({
        assignments: expect.any(Object),
        board: expect.any(Object),
        _count: expect.any(Object),
      });
    });

    it('should limit results to 200 tasks', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTasksBySpace('space-1');

      const query = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(query.take).toBe(200);
    });
  });

  // ─── getCommentsByTask ───────────────────────────────────────

  describe('getCommentsByTask()', () => {
    it('UT-AI-DP-002: should return comments for specific task with author info', async () => {
      const mockComments = [{ id: 'c-1', content: 'Review needed', author: { id: 'u-1', name: 'Ali' } }];
      (prisma.comment.findMany as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getCommentsByTask('task-1');

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId: 'task-1' },
          include: expect.objectContaining({ author: expect.any(Object) }),
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toEqual(mockComments);
    });
  });

  // ─── getCommentsBySpace ──────────────────────────────────────

  describe('getCommentsBySpace()', () => {
    it('UT-AI-DP-003: should return comments scoped to space with 1000 limit', async () => {
      (prisma.comment.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCommentsBySpace('space-1');

      const query = (prisma.comment.findMany as jest.Mock).mock.calls[0][0];
      expect(query.where).toMatchObject({
        task: { board: { department: { spaceId: 'space-1' } } },
      });
      expect(query.take).toBe(1000);
    });
  });

  // ─── getAuditLogBySpace ──────────────────────────────────────

  describe('getAuditLogBySpace()', () => {
    it('UT-AI-DP-004: should return audit logs scoped to space with default 200 limit', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.getAuditLogBySpace('space-1');

      const query = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(query.where).toMatchObject({
        user: { memberships: { some: { spaceId: 'space-1' } } },
      });
      expect(query.take).toBe(200);
    });

    it('should accept custom limit', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.getAuditLogBySpace('space-1', 50);

      const query = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(query.take).toBe(50);
    });
  });

  // ─── getSchemaDescription ────────────────────────────────────

  describe('getSchemaDescription()', () => {
    it('UT-AI-DP-005: should return schema with all required tables', () => {
      const schema = service.getSchemaDescription();

      expect(schema.tables).toBeInstanceOf(Array);
      expect(schema.tables.length).toBeGreaterThanOrEqual(5);

      const tableNames = schema.tables.map((t) => t.name);
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('boards');
      expect(tableNames).toContain('comments');
    });

    it('should include task status and priority enums', () => {
      const schema = service.getSchemaDescription();
      const tasksTable = schema.tables.find((t) => t.name === 'tasks');

      expect(tasksTable).toBeDefined();
      expect((tasksTable as any).enums?.status).toContain('BLOCKED');
      expect((tasksTable as any).enums?.priority).toContain('URGENT');
    });

    it('should include tenant key guidance', () => {
      const schema = service.getSchemaDescription();
      expect(schema.tenantKey).toContain('spaceId');
    });
  });
});
