import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TrashService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all soft-deleted items in a given Space.
   */
  async listTrash(spaceId: string) {
    const [boards, tasks, workflows] = await Promise.all([
      this.prisma.board.findMany({
        where: {
          deletedAt: { not: null },
          department: { spaceId },
        },
        include: {
          department: { select: { name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          deletedAt: { not: null },
          board: { department: { spaceId } },
        },
        include: {
          board: { select: { name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      this.prisma.workflowInstance.findMany({
        where: {
          deletedAt: { not: null },
          spaceId,
        },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    return {
      boards: boards.map((b) => ({
        id: b.id,
        name: b.name,
        type: 'board',
        departmentName: b.department.name,
        deletedAt: b.deletedAt,
        deletedById: b.deletedById,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.title,
        identifier: t.identifier,
        type: 'task',
        boardName: t.board.name,
        deletedAt: t.deletedAt,
        deletedById: t.deletedById,
      })),
      workflows: workflows.map((w) => ({
        id: w.id,
        name: `${w.entityType} Workflow #${w.id.substring(0, 8)}`,
        type: 'workflow',
        deletedAt: w.deletedAt,
        deletedById: w.deletedById,
      })),
    };
  }

  /**
   * Soft delete a board, including all its columns and tasks.
   */
  async softDeleteBoard(boardId: string, userId: string) {
    const restoreToken = randomUUID();
    const deletedAt = new Date();

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException('Board not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.board.update({
        where: { id: boardId },
        data: { deletedAt, deletedById: userId, restoreToken, isArchived: true },
      });

      await tx.boardColumn.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt, deletedById: userId, restoreToken },
      });

      await tx.task.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt, deletedById: userId, restoreToken, isArchived: true },
      });
    });
  }

  /**
   * Soft delete a board column, including all its tasks.
   */
  async softDeleteColumn(columnId: string, userId: string) {
    const restoreToken = randomUUID();
    const deletedAt = new Date();

    const col = await this.prisma.boardColumn.findUnique({
      where: { id: columnId },
    });
    if (!col) throw new NotFoundException('Column not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.boardColumn.update({
        where: { id: columnId },
        data: { deletedAt, deletedById: userId, restoreToken },
      });

      await tx.task.updateMany({
        where: { columnId, deletedAt: null },
        data: { deletedAt, deletedById: userId, restoreToken, isArchived: true },
      });
    });
  }

  /**
   * Soft delete a task, including all its recursive subtasks.
   */
  async softDeleteTask(taskId: string, userId: string) {
    const restoreToken = randomUUID();
    const deletedAt = new Date();

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');

    const subtaskIds = await this.getSubtaskIdsRecursive(taskId);
    const allTaskIds = [taskId, ...subtaskIds];

    await this.prisma.task.updateMany({
      where: { id: { in: allTaskIds }, deletedAt: null },
      data: { deletedAt, deletedById: userId, restoreToken, isArchived: true },
    });
  }

  /**
   * Soft delete a workflow instance.
   */
  async softDeleteWorkflowInstance(instanceId: string, userId: string) {
    const restoreToken = randomUUID();
    const deletedAt = new Date();

    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { deletedAt, deletedById: userId, restoreToken },
    });
  }

  /**
   * Restore any soft-deleted item and its cascade descendants.
   */
  async restore(id: string) {
    // 1. Try Board
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: { id: true, restoreToken: true },
    });
    if (board && board.restoreToken) {
      const restoreToken = board.restoreToken;
      await this.prisma.$transaction(async (tx) => {
        await tx.board.update({
          where: { id },
          data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
        });
        await tx.boardColumn.updateMany({
          where: { boardId: id, restoreToken },
          data: { deletedAt: null, deletedById: null, restoreToken: null },
        });
        await tx.task.updateMany({
          where: { boardId: id, restoreToken },
          data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
        });
      });
      return { type: 'board', id };
    }

    // 2. Try Column
    const col = await this.prisma.boardColumn.findUnique({
      where: { id },
      select: { id: true, restoreToken: true },
    });
    if (col && col.restoreToken) {
      const restoreToken = col.restoreToken;
      await this.prisma.$transaction(async (tx) => {
        await tx.boardColumn.update({
          where: { id },
          data: { deletedAt: null, deletedById: null, restoreToken: null },
        });
        await tx.task.updateMany({
          where: { columnId: id, restoreToken },
          data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
        });
      });
      return { type: 'column', id };
    }

    // 3. Try Task
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true, restoreToken: true },
    });
    if (task && task.restoreToken) {
      const restoreToken = task.restoreToken;
      await this.prisma.task.updateMany({
        where: { restoreToken },
        data: { deletedAt: null, deletedById: null, restoreToken: null, isArchived: false },
      });
      return { type: 'task', id };
    }

    // 4. Try WorkflowInstance
    const workflow = await this.prisma.workflowInstance.findUnique({
      where: { id },
      select: { id: true, restoreToken: true },
    });
    if (workflow && workflow.restoreToken) {
      await this.prisma.workflowInstance.update({
        where: { id },
        data: { deletedAt: null, deletedById: null, restoreToken: null },
      });
      return { type: 'workflow', id };
    }

    throw new NotFoundException('Item not found in trash or cannot be restored');
  }

  /**
   * Hard delete / purge an item permanently.
   */
  async purge(id: string) {
    // 1. Try Board
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: { id: true },
    });
    if (board) {
      await this.prisma.board.delete({ where: { id } });
      return { type: 'board', id };
    }

    // 2. Try Column
    const col = await this.prisma.boardColumn.findUnique({
      where: { id },
      select: { id: true },
    });
    if (col) {
      await this.prisma.boardColumn.delete({ where: { id } });
      return { type: 'column', id };
    }

    // 3. Try Task
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (task) {
      await this.prisma.task.delete({ where: { id } });
      return { type: 'task', id };
    }

    // 4. Try WorkflowInstance
    const workflow = await this.prisma.workflowInstance.findUnique({
      where: { id },
      select: { id: true },
    });
    if (workflow) {
      await this.prisma.workflowInstance.delete({ where: { id } });
      return { type: 'workflow', id };
    }

    throw new NotFoundException('Item not found in trash');
  }

  private async getSubtaskIdsRecursive(taskId: string): Promise<string[]> {
    const subtasks = await this.prisma.task.findMany({
      where: { parentId: taskId },
      select: { id: true },
    });
    let ids = subtasks.map((t) => t.id);
    for (const id of ids) {
      const subIds = await this.getSubtaskIdsRecursive(id);
      ids = [...ids, ...subIds];
    }
    return ids;
  }
}
