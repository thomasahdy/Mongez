import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { randomUUID } from 'crypto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { SpaceAccessService } from '../../common/services/space-access.service';

@Injectable()
export class TrashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly spaceAccess: SpaceAccessService,
  ) {}

  /**
   * Resolve the owning spaceId of any trashable item (board / column / task /
   * workflow instance) by its id, so tenant isolation can be enforced before
   * restoring or purging. Returns null if the item does not exist.
   */
  private async resolveItemSpaceId(id: string): Promise<string | null> {
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: { department: { select: { spaceId: true } } },
    });
    if (board) return board.department?.spaceId ?? null;

    const col = await this.prisma.boardColumn.findUnique({
      where: { id },
      select: { board: { select: { department: { select: { spaceId: true } } } } },
    });
    if (col) return col.board?.department?.spaceId ?? null;

    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { board: { select: { department: { select: { spaceId: true } } } } },
    });
    if (task) return task.board?.department?.spaceId ?? null;

    const workflow = await this.prisma.workflowInstance.findUnique({
      where: { id },
      select: { spaceId: true },
    });
    if (workflow) return workflow.spaceId;

    return null;
  }

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
  async restore(id: string, userId: string) {
    // Tenant isolation: caller must be a member of the item's space.
    const spaceId = await this.resolveItemSpaceId(id);
    if (!spaceId) {
      throw new NotFoundException('Item not found in trash or cannot be restored');
    }
    await this.spaceAccess.assertMember(userId, spaceId);

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
  async purge(id: string, userId: string) {
    // Tenant isolation: permanent deletion requires OWNER/ADMIN of the item's space.
    const spaceId = await this.resolveItemSpaceId(id);
    if (!spaceId) {
      throw new NotFoundException('Item not found in trash');
    }
    await this.spaceAccess.assertMember(userId, spaceId, ['OWNER', 'ADMIN']);

    // 1. Try Board
    const board = await this.prisma.board.findUnique({
      where: { id },
      select: { id: true },
    });
    if (board) {
      const tasks = await this.prisma.task.findMany({
        where: { boardId: id },
        select: { id: true },
      });
      await this.deletePhysicalFilesForTasks(tasks.map((t) => t.id));
      await this.prisma.board.delete({ where: { id } });
      return { type: 'board', id };
    }

    // 2. Try Column
    const col = await this.prisma.boardColumn.findUnique({
      where: { id },
      select: { id: true },
    });
    if (col) {
      const tasks = await this.prisma.task.findMany({
        where: { columnId: id },
        select: { id: true },
      });
      await this.deletePhysicalFilesForTasks(tasks.map((t) => t.id));
      await this.prisma.boardColumn.delete({ where: { id } });
      return { type: 'column', id };
    }

    // 3. Try Task
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (task) {
      const subtaskIds = await this.getSubtaskIdsRecursive(id);
      const allTaskIds = [id, ...subtaskIds];
      await this.deletePhysicalFilesForTasks(allTaskIds);
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

  private async deletePhysicalFilesForTasks(taskIds: string[]) {
    if (!taskIds.length) return;
    try {
      const versions = await this.prisma.fileVersion.findMany({
        where: {
          attachment: {
            taskId: { in: taskIds },
          },
        },
        select: { storageKey: true },
      });
      for (const v of versions) {
        await this.storage.delete(v.storageKey).catch(() => {});
      }
    } catch (err) {
      // Don't crash purge if storage deletion fails
    }
  }

  private async getSubtaskIdsRecursive(taskId: string): Promise<string[]> {
    const subtaskIds = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE subtasks AS (
        SELECT id FROM tasks WHERE "parentId" = ${taskId}
        UNION ALL
        SELECT t.id FROM tasks t
        INNER JOIN subtasks s ON t."parentId" = s.id
      )
      SELECT id FROM subtasks;
    `;
    return subtaskIds.map((row) => row.id);
  }
}
