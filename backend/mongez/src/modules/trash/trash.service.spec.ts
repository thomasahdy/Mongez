import { TrashService } from './trash.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TrashService', () => {
  let service: TrashService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      board: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      boardColumn: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      workflowInstance: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    service = new TrashService(prisma as PrismaService);
  });

  // ─── listTrash() ─────────────────────────────────────────────

  describe('listTrash()', () => {
    it('UT-TRASH-LIST-001: should return mapped soft-deleted boards, tasks, and workflows', async () => {
      prisma.board.findMany.mockResolvedValue([
        { id: 'board-1', name: 'Board A', deletedAt: new Date(), deletedById: 'u-1', department: { name: 'Dept A' } },
      ]);
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Task A', identifier: 'T-1', deletedAt: new Date(), deletedById: 'u-1', board: { name: 'Board A' } },
      ]);
      prisma.workflowInstance.findMany.mockResolvedValue([
        { id: 'wf-1', entityType: 'BUDGET', deletedAt: new Date(), deletedById: 'u-1' },
      ]);

      const result = await service.listTrash('space-1');

      expect(result.boards).toHaveLength(1);
      expect(result.boards[0].departmentName).toBe('Dept A');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].boardName).toBe('Board A');
      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].name).toContain('BUDGET');
    });
  });

  // ─── softDeleteBoard() ───────────────────────────────────────

  describe('softDeleteBoard()', () => {
    it('UT-TRASH-DELBOARD-001: should throw NotFoundException if board not found', async () => {
      prisma.board.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteBoard('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('UT-TRASH-DELBOARD-002: should soft-delete board, columns, and tasks in transaction', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board-1' });

      await service.softDeleteBoard('board-1', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 'board-1' },
        data: expect.objectContaining({
          deletedById: 'user-1',
          restoreToken: expect.any(String),
          isArchived: true,
        }),
      });
      expect(prisma.boardColumn.updateMany).toHaveBeenCalledWith({
        where: { boardId: 'board-1', deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-1' }),
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { boardId: 'board-1', deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-1', isArchived: true }),
      });
    });
  });

  // ─── softDeleteColumn() ──────────────────────────────────────

  describe('softDeleteColumn()', () => {
    it('UT-TRASH-DELCOL-001: should throw NotFoundException if column not found', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteColumn('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('UT-TRASH-DELCOL-002: should soft-delete column and its tasks', async () => {
      prisma.boardColumn.findUnique.mockResolvedValue({ id: 'col-1' });

      await service.softDeleteColumn('col-1', 'user-1');

      expect(prisma.boardColumn.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: expect.objectContaining({ deletedById: 'user-1' }),
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { columnId: 'col-1', deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-1', isArchived: true }),
      });
    });
  });

  // ─── softDeleteTask() ────────────────────────────────────────

  describe('softDeleteTask()', () => {
    it('UT-TRASH-DELTASK-001: should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteTask('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('UT-TRASH-DELTASK-002: should soft-delete task and its recursive subtasks', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1' });
      prisma.task.findMany
        .mockResolvedValueOnce([{ id: 'subtask-1' }]) // first level parentId = task-1
        .mockResolvedValueOnce([]); // second level parentId = subtask-1

      await service.softDeleteTask('task-1', 'user-1');

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['task-1', 'subtask-1'] }, deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-1', isArchived: true }),
      });
    });
  });

  // ─── softDeleteWorkflowInstance() ────────────────────────────

  describe('softDeleteWorkflowInstance()', () => {
    it('UT-TRASH-DELWF-001: should throw NotFoundException if workflow not found', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(service.softDeleteWorkflowInstance('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('UT-TRASH-DELWF-002: should soft-delete workflow instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({ id: 'wf-1' });

      await service.softDeleteWorkflowInstance('wf-1', 'user-1');

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: expect.objectContaining({ deletedById: 'user-1' }),
      });
    });
  });

  // ─── restore() ───────────────────────────────────────────────

  describe('restore()', () => {
    it('UT-TRASH-REST-001: should restore board, columns, and tasks', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board-1', restoreToken: 'token-b' });

      const result = await service.restore('board-1');

      expect(result).toEqual({ type: 'board', id: 'board-1' });
      expect(prisma.board.update).toHaveBeenCalledWith({
        where: { id: 'board-1' },
        data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
      });
      expect(prisma.boardColumn.updateMany).toHaveBeenCalledWith({
        where: { boardId: 'board-1', restoreToken: 'token-b' },
        data: { deletedAt: null, deletedById: null, restoreToken: null },
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { boardId: 'board-1', restoreToken: 'token-b' },
        data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
      });
    });

    it('UT-TRASH-REST-002: should restore column and its tasks', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue({ id: 'col-1', restoreToken: 'token-c' });

      const result = await service.restore('col-1');

      expect(result).toEqual({ type: 'column', id: 'col-1' });
      expect(prisma.boardColumn.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: { deletedAt: null, deletedById: null, restoreToken: null },
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { columnId: 'col-1', restoreToken: 'token-c' },
        data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
      });
    });

    it('UT-TRASH-REST-003: should restore tasks matching restoreToken', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1', restoreToken: 'token-t' });

      const result = await service.restore('task-1');

      expect(result).toEqual({ type: 'task', id: 'task-1' });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { restoreToken: 'token-t' },
        data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
      });
    });

    it('UT-TRASH-REST-004: should restore workflow instance', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue(null);
      prisma.workflowInstance.findUnique.mockResolvedValue({ id: 'wf-1', restoreToken: 'token-w' });

      const result = await service.restore('wf-1');

      expect(result).toEqual({ type: 'workflow', id: 'wf-1' });
      expect(prisma.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: { deletedAt: null, deletedById: null, restoreToken: null },
      });
    });

    it('UT-TRASH-REST-005: should throw NotFoundException if item not found in trash', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue(null);
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(service.restore('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── purge() ─────────────────────────────────────────────────

  describe('purge()', () => {
    it('UT-TRASH-PURGE-001: should purge board', async () => {
      prisma.board.findUnique.mockResolvedValue({ id: 'board-1' });

      const result = await service.purge('board-1');

      expect(result).toEqual({ type: 'board', id: 'board-1' });
      expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: 'board-1' } });
    });

    it('UT-TRASH-PURGE-002: should purge column', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue({ id: 'col-1' });

      const result = await service.purge('col-1');

      expect(result).toEqual({ type: 'column', id: 'col-1' });
      expect(prisma.boardColumn.delete).toHaveBeenCalledWith({ where: { id: 'col-1' } });
    });

    it('UT-TRASH-PURGE-003: should purge task', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue({ id: 'task-1' });

      const result = await service.purge('task-1');

      expect(result).toEqual({ type: 'task', id: 'task-1' });
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('UT-TRASH-PURGE-004: should purge workflow instance', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue(null);
      prisma.workflowInstance.findUnique.mockResolvedValue({ id: 'wf-1' });

      const result = await service.purge('wf-1');

      expect(result).toEqual({ type: 'workflow', id: 'wf-1' });
      expect(prisma.workflowInstance.delete).toHaveBeenCalledWith({ where: { id: 'wf-1' } });
    });

    it('UT-TRASH-PURGE-005: should throw NotFoundException if purge item not found', async () => {
      prisma.board.findUnique.mockResolvedValue(null);
      prisma.boardColumn.findUnique.mockResolvedValue(null);
      prisma.task.findUnique.mockResolvedValue(null);
      prisma.workflowInstance.findUnique.mockResolvedValue(null);

      await expect(service.purge('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });
});
