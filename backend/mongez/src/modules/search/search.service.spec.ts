import { SearchService } from './search.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      task: {
        findMany: jest.fn(),
      },
      workflowInstance: {
        findMany: jest.fn(),
      },
      attachment: {
        findMany: jest.fn(),
      },
      comment: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    service = new SearchService(prisma as PrismaService);
  });

  // ─── globalSearch() ──────────────────────────────────────────

  describe('globalSearch()', () => {
    it('UT-SEARCH-GLOB-001: should only query requested entity types', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([{ id: 'app-1' }]);
      
      const result = await service.globalSearch('user-1', {
        q: 'test',
        spaceId: 'space-1',
        types: ['approval'],
      });

      expect(prisma.workflowInstance.findMany).toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
      expect(prisma.comment.findMany).not.toHaveBeenCalled();

      expect(result.approvals).toHaveLength(1);
      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it('UT-SEARCH-GLOB-002: should combine all search results and return total count', async () => {
      // Mock searchTasks to return via raw SQL
      prisma.$queryRaw.mockResolvedValue([{ id: 'task-1', title: 'Task 1' }]);
      prisma.workflowInstance.findMany.mockResolvedValue([{ id: 'app-1' }]);
      prisma.attachment.findMany.mockResolvedValue([{ id: 'file-1', fileName: 'file.pdf' }]);
      prisma.comment.findMany.mockResolvedValue([{ id: 'comment-1', content: 'comment' }]);

      const result = await service.globalSearch('user-1', {
        q: 'test',
        spaceId: 'space-1',
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.approvals).toHaveLength(1);
      expect(result.files).toHaveLength(1);
      expect(result.comments).toHaveLength(1);
      expect(result.total).toBe(4);
    });
  });

  // ─── searchTasks() ───────────────────────────────────────────

  describe('searchTasks()', () => {
    it('UT-SEARCH-TASK-001: should query raw SQL for FTS and return results if found', async () => {
      const mockTasks = [{ id: 'task-1', title: 'FTS Match', rank: 0.9 }];
      prisma.$queryRaw.mockResolvedValue(mockTasks);

      const result = await service.searchTasks('fts-query', 'space-1', {
        q: 'fts-query',
        spaceId: 'space-1',
        limit: 10,
        page: 1,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(mockTasks);
    });

    it('UT-SEARCH-TASK-002: should fall back to findMany (ILIKE) when FTS returns empty', async () => {
      prisma.$queryRaw.mockResolvedValue([]); // FTS returns empty
      const mockFallback = [{ id: 'task-2', title: 'Fallback Match' }];
      prisma.task.findMany.mockResolvedValue(mockFallback);

      const result = await service.searchTasks('short', 'space-1', {
        q: 'short',
        spaceId: 'space-1',
        limit: 5,
        page: 2,
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          board: { department: { spaceId: 'space-1' } },
          isArchived: false,
          OR: [
            { title: { contains: 'short', mode: 'insensitive' } },
            { description: { contains: 'short', mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          title: true,
          description: true,
          tags: true,
          status: true,
          priority: true,
          dueDate: true,
        },
        take: 5,
        skip: 5, // (2 - 1) * 5
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockFallback);
    });

    it('UT-SEARCH-TASK-003: should apply assignee, status, and overdue filters in fallback', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);

      await service.searchTasks('test', 'space-1', {
        q: 'test',
        spaceId: 'space-1',
        assigneeId: 'user-assignee',
        status: 'IN_PROGRESS',
        overdue: true,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
            assignments: { some: { userId: 'user-assignee' } },
            dueDate: { lt: expect.any(Date) },
            status: expect.objectContaining({ notIn: ['DONE', 'CANCELLED'] }),
          }),
        }),
      );
    });
  });

  // ─── searchApprovals() ───────────────────────────────────────

  describe('searchApprovals()', () => {
    it('UT-SEARCH-APP-001: should query workflow instances matching definition or requester name', async () => {
      prisma.workflowInstance.findMany.mockResolvedValue([{ id: 'wf-1' }]);

      const result = await service.searchApprovals('req-name', 'space-1', {
        q: 'req-name',
        spaceId: 'space-1',
        limit: 10,
        page: 1,
      });

      expect(prisma.workflowInstance.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          OR: [
            { definition: { name: { contains: 'req-name', mode: 'insensitive' } } },
            { requester: { name: { contains: 'req-name', mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          status: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          resolvedAt: true,
          definition: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, avatarUrl: true } },
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ─── searchFiles() ───────────────────────────────────────────

  describe('searchFiles()', () => {
    it('UT-SEARCH-FILE-001: should search attachments by fileName contains', async () => {
      prisma.attachment.findMany.mockResolvedValue([{ id: 'file-1' }]);

      const result = await service.searchFiles('notes.txt', 'space-1', {
        q: 'notes.txt',
        spaceId: 'space-1',
      });

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          task: { board: { department: { spaceId: 'space-1' } } },
          fileName: { contains: 'notes.txt', mode: 'insensitive' },
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          createdAt: true,
          task: { select: { id: true, identifier: true, title: true } },
        },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ─── searchComments() ────────────────────────────────────────

  describe('searchComments()', () => {
    it('UT-SEARCH-COMM-001: should search non-deleted comments by content contains', async () => {
      prisma.comment.findMany.mockResolvedValue([{ id: 'c-1' }]);

      const result = await service.searchComments('quick fix', 'space-1', {
        q: 'quick fix',
        spaceId: 'space-1',
      });

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          task: { board: { department: { spaceId: 'space-1' } } },
          deletedAt: null,
          content: { contains: 'quick fix', mode: 'insensitive' },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
          task: { select: { id: true, identifier: true, title: true } },
        },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ─── suggestions() ───────────────────────────────────────────

  describe('suggestions()', () => {
    it('UT-SEARCH-SUG-001: should return empty list if query is less than 2 characters', async () => {
      const result = await service.suggestions('a', 'space-1');
      expect(result).toEqual([]);
      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });

    it('UT-SEARCH-SUG-002: should return suggestions matching start of query for tasks and files', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Start of query task' }]);
      prisma.attachment.findMany.mockResolvedValue([{ id: 'file-1', fileName: 'Start of query file.txt' }]);

      const result = await service.suggestions('Start', 'space-1');

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          board: { department: { spaceId: 'space-1' } },
          isArchived: false,
          title: { startsWith: 'Start', mode: 'insensitive' },
        },
        select: { id: true, title: true },
        take: 5,
      });

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          task: { board: { department: { spaceId: 'space-1' } } },
          fileName: { startsWith: 'Start', mode: 'insensitive' },
        },
        select: { id: true, fileName: true },
        take: 5,
      });

      expect(result).toEqual([
        { id: 'task-1', text: 'Start of query task', type: 'task' },
        { id: 'file-1', text: 'Start of query file.txt', type: 'file' },
      ]);
    });
  });

  // ─── getFilters() ────────────────────────────────────────────

  describe('getFilters()', () => {
    it('UT-SEARCH-FILT-001: should query assignees and unique task statuses in space', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'John' }]);
      prisma.task.findMany.mockResolvedValue([{ status: 'TODO' }, { status: 'IN_PROGRESS' }]);

      const result = await service.getFilters('space-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          memberships: { some: { spaceId: 'space-1' } },
          assignedTasks: { some: { task: { board: { department: { spaceId: 'space-1' } } } } },
        },
        select: { id: true, name: true, avatarUrl: true },
        take: 50,
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { board: { department: { spaceId: 'space-1' } } },
        distinct: ['status'],
        select: { status: true },
      });

      expect(result).toEqual({
        assignees: [{ id: 'user-1', name: 'John' }],
        statuses: ['TODO', 'IN_PROGRESS'],
        types: ['task', 'approval', 'file', 'comment'],
      });
    });
  });
});
