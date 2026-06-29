import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { MoveTaskDto } from '../dto/move-task.dto';
import { FilterTasksDto } from '../dto/filter-tasks.dto';
import { IdentifierService } from '../../../shared/services/identifier.service';

const userSelect = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly TASK_INCLUDE = {
    assignments: { include: { user: { select: userSelect } } },
    board: { select: { id: true, name: true, department: { select: { spaceId: true } } } },
    views: { select: { userId: true, viewedAt: true, user: { select: userSelect } } },
    subtasks: {
      include: {
        assignments: { include: { user: { select: userSelect } } },
      },
      orderBy: {
        position: 'asc' as const,
      },
    },
    dependencies: {
      include: {
        dependsOn: {
          select: {
            id: true,
            identifier: true,
            title: true,
            status: true,
          },
        },
      },
    },
    _count: { select: { comments: true, attachments: true, subtasks: true } },
  };

  async findById(id: string) {
    return this.prisma.task.findUnique({ where: { id }, include: this.TASK_INCLUDE });
  }

  async findByBoard(boardId: string, filters: FilterTasksDto) {
    const { page, limit, search, status, priority, assigneeId, dueBefore, dueAfter, tags, includeArchived } = filters;
    const pageNum = Number(page || 1);
    const limitNum = Number(limit || 50);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.TaskWhereInput & { searchVector?: any } = {
      boardId,
      isArchived: includeArchived ? undefined : false,
      ...(status?.length && { status: { in: status } }),
      ...(priority?.length && { priority: { in: priority } }),
      ...(assigneeId && { assignments: { some: { userId: assigneeId } } }),
      ...(dueBefore && { dueDate: { lte: new Date(dueBefore) } }),
      ...(dueAfter && { dueDate: { gte: new Date(dueAfter) } }),
      ...(tags?.length && { tags: { hasSome: tags } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ columnId: 'asc' }, { position: 'asc' }],
        include: this.TASK_INCLUDE,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total };
  }

  async create(dto: CreateTaskDto, spaceId: string, prefix: string, identifierService: IdentifierService, creatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lastTask = await tx.task.findFirst({
        where: { columnId: dto.columnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const identifier = await identifierService.nextIdentifier(spaceId, prefix, tx);
      const position = (lastTask?.position ?? -1) + 1;

      const task = await tx.task.create({
        data: {
          identifier,
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          type: dto.type ?? 'Task',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          estimatedHours: dto.estimatedHours,
          parentId: dto.parentId,
          tags: dto.tags || [],
          boardId: dto.boardId,
          columnId: dto.columnId,
          position,
          createdById: creatorId,
        },
        include: this.TASK_INCLUDE,
      });

      if (dto.assigneeIds?.length) {
        await tx.taskAssignment.createMany({
          data: dto.assigneeIds.map((userId) => ({ taskId: task.id, userId })),
        });
      }

      await tx.taskJournal.create({
        data: { taskId: task.id, changes: { field: 'created', from: null, to: 'task created' }, userId: creatorId },
      });

      // 2. Log to Outbox (Transactional Outbox Pattern)
      // This guarantees the notification is processed even if the API server crashes
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Task',
          aggregateId: task.id,
          eventType: 'task.created',
          payload: {
            eventId: `evt-create-${task.id}-${Date.now()}`,
            correlationId: task.id,
            occurredAt: new Date().toISOString(),
            spaceId,
            taskId: task.id,
            title: task.title,
            creatorId,
            assigneeIds: dto.assigneeIds || [],
          },
        },
      });

      if (dto.assigneeIds?.length) {
        for (const assigneeId of dto.assigneeIds) {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Task',
              aggregateId: task.id,
              eventType: 'task.assigned',
              payload: {
                eventId: `evt-assign-${task.id}-${assigneeId}-${Date.now()}`,
                correlationId: task.id,
                occurredAt: new Date().toISOString(),
                spaceId,
                taskId: task.id,
                assigneeId,
                assignerId: creatorId,
              },
            },
          });
        }
      }

      return task;
    });
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const { assigneeIds, ...taskData } = dto;
    const before = await this.prisma.task.findUnique({ where: { id } });

    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: taskData,
        include: this.TASK_INCLUDE,
      });

      if (assigneeIds !== undefined) {
        await tx.taskAssignment.deleteMany({ where: { taskId: id } });
        if (assigneeIds.length > 0) {
          await tx.taskAssignment.createMany({
            data: assigneeIds.map((assigneeId) => ({
              taskId: id,
              userId: assigneeId,
            })),
          });
        }
      }

      const changed = Object.keys(taskData).filter((k) => (before as any)[k] !== (taskData as any)[k]);
      if (changed.length) {
        await tx.taskJournal.createMany({
          data: changed.map((field) => ({
            taskId: id,
            changes: { field, from: String((before as any)[field] ?? ''), to: String((taskData as any)[field] ?? '') },
            userId,
          })),
        });
      }

      return tx.task.findUnique({
        where: { id },
        include: this.TASK_INCLUDE,
      });
    });

    return task;
  }

  async move(id: string, dto: MoveTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      // 0. Serialize concurrent moves in the column via explicit row-level lock
      const targetColumnId = dto.columnId;
      if (targetColumnId) {
        await tx.$executeRawUnsafe(
          `SELECT id FROM "board_columns" WHERE id = $1 FOR UPDATE`,
          targetColumnId,
        );
      }

      const task = await tx.task.findUnique({ where: { id } });
      if (!task) throw new NotFoundException('Task not found');

      const sourceColumnId = task.columnId;
      const sourcePosition = task.position;
      const targetPosition = dto.position;

      if (sourceColumnId === targetColumnId) {
        if (sourcePosition > targetPosition) {
          // Moving up: increment positions of tasks between target and source
          await tx.task.updateMany({
            where: {
              columnId: sourceColumnId,
              position: { gte: targetPosition, lt: sourcePosition },
            },
            data: { position: { increment: 1 } },
          });
        } else if (sourcePosition < targetPosition) {
          // Moving down: decrement positions of tasks between source and target
          await tx.task.updateMany({
            where: {
              columnId: sourceColumnId,
              position: { gt: sourcePosition, lte: targetPosition },
            },
            data: { position: { decrement: 1 } },
          });
        }
      } else {
        // Moving to another column:
        // 1. Close the gap in the source column
        await tx.task.updateMany({
          where: {
            columnId: sourceColumnId,
            position: { gt: sourcePosition },
          },
          data: { position: { decrement: 1 } },
        });

        // 2. Make room in the target column
        await tx.task.updateMany({
          where: {
            columnId: targetColumnId,
            position: { gte: targetPosition },
          },
          data: { position: { increment: 1 } },
        });
      }

      // 3. Move the task itself
      return tx.task.update({
        where: { id },
        data: { columnId: targetColumnId, position: targetPosition },
        include: this.TASK_INCLUDE,
      });
    });
  }

  async archive(id: string) {
    return this.prisma.task.update({ where: { id }, data: { isArchived: true } });
  }

  async search(query: string, spaceId: string, skip: number, limit: number) {
    const limitNum = Number(limit || 50);
    const skipNum = Number(skip || 0);

    if (!query) {
      const where: Prisma.TaskWhereInput = {
        board: { department: { spaceId } },
        isArchived: false,
      };
      const [data, total] = await Promise.all([
        this.prisma.task.findMany({ where, skip: skipNum, take: limitNum, include: this.TASK_INCLUDE }),
        this.prisma.task.count({ where }),
      ]);
      return { data, total };
    }

    // Raw SQL to leverage full-text search on GIN-indexed searchVector column
    const matches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT t.id
      FROM "tasks" t
      JOIN "boards" b ON t."boardId" = b.id
      JOIN "departments" d ON b."departmentId" = d.id
      WHERE d."spaceId" = ${spaceId}
        AND t."isArchived" = false
        AND t."searchVector" @@ plainto_tsquery(${query})
    `;

    const total = matches.length;
    const matchedIds = matches.slice(skipNum, skipNum + limitNum).map((m) => m.id);

    if (matchedIds.length === 0) {
      // Fallback: short/typo search fallback using standard contains query
      const where: Prisma.TaskWhereInput = {
        board: { department: { spaceId } },
        isArchived: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      };
      const [data, totalCount] = await Promise.all([
        this.prisma.task.findMany({ where, skip: skipNum, take: limitNum, include: this.TASK_INCLUDE }),
        this.prisma.task.count({ where }),
      ]);
      return { data, total: totalCount };
    }

    const data = await this.prisma.task.findMany({
      where: { id: { in: matchedIds } },
      include: this.TASK_INCLUDE,
    });

    const dataSorted = matchedIds.map((id) => data.find((t) => t.id === id)).filter(Boolean);

    return { data: dataSorted, total };
  }

  async findMyWork(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        isArchived: false,
        assignments: {
          some: { userId },
        },
      },
      include: {
        board: {
          select: {
            id: true,
            name: true,
            department: {
              select: {
                name: true,
                space: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const overdue = tasks.filter((t) => {
      if (t.status === 'DONE' || t.status === 'CANCELLED') return false;
      return t.dueDate && new Date(t.dueDate) < todayStart;
    });

    const today = tasks.filter((t) => {
      if (t.status === 'DONE' || t.status === 'CANCELLED') return false;
      return t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd;
    });

    const upcoming = tasks.filter((t) => {
      if (t.status === 'DONE' || t.status === 'CANCELLED') return false;
      return t.dueDate && new Date(t.dueDate) > todayEnd;
    });

    const completed = tasks.filter((t) => t.status === 'DONE');

    const oneWeekLater = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisWeek = tasks.filter((t) => {
      if (t.status === 'DONE' || t.status === 'CANCELLED') return false;
      return t.dueDate && new Date(t.dueDate) > todayEnd && new Date(t.dueDate) <= oneWeekLater;
    });

    const noDueDate = tasks.filter((t) => {
      if (t.status === 'DONE' || t.status === 'CANCELLED') return false;
      return !t.dueDate;
    });

    return {
      overdue,
      today,
      upcoming,
      noDueDate,
      stats: {
        overdueCount: overdue.length,
        todayCount: today.length,
        thisWeekCount: thisWeek.length,
        completedCount: completed.length,
        noDueDateCount: noDueDate.length,
      },
    };
  }
}

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTask(taskId: string, page: number, limit: number) {
    const pageNum = Number(page || 1);
    const limitNum = Number(limit || 50);
    const skip = (pageNum - 1) * limitNum;
    const where = { taskId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where, skip, take: limitNum,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: userSelect },
          reactions: true,
          mentions: true,
        },
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { data, total };
  }

  async create(taskId: string, authorId: string, content: string, spaceId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { taskId, authorId, content },
        include: { author: { select: userSelect } },
      });

      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[2]);
      }

      if (mentions.length) {
        await tx.mention.createMany({
          data: mentions.map((userId) => ({ commentId: comment.id, mentionedId: userId })),
          skipDuplicates: true,
        });

        // Resolve task space and title for notification payload
        const task = await tx.task.findUnique({
          where: { id: taskId },
          select: { title: true, spaceId: true },
        });
        const resolvedSpaceId = spaceId || task?.spaceId || '';

        // Write outbox event for each mentioned user
        const author = comment.author;
        for (const userId of mentions) {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Task',
              aggregateId: taskId,
              eventType: 'comment.mention',
              payload: {
                eventId: `evt-mention-${comment.id}-${userId}-${Date.now()}`,
                correlationId: taskId,
                occurredAt: new Date().toISOString(),
                spaceId: resolvedSpaceId,
                userId,
                actorName: author?.name || 'Someone',
                entityLabel: task?.title || 'a task',
                title: 'You were mentioned',
                body: `${author?.name || 'Someone'} mentioned you in a comment on a task`,
              },
            },
          });
        }
      }

      return { comment, mentionedUserIds: mentions };
    });
  }

  async update(id: string, authorId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.authorId !== authorId) {
      throw new ForbiddenException('Cannot edit this comment');
    }
    return this.prisma.comment.update({
      where: { id }, data: { content, isEdited: true },
    });
  }

  async softDelete(id: string, authorId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.authorId !== authorId) {
      throw new ForbiddenException('Cannot delete this comment');
    }
    return this.prisma.comment.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

@Injectable()
export class TimeLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async logTime(taskId: string, userId: string, hours: number, description?: string, date?: string) {
    return this.prisma.timeLog.create({
      data: {
        taskId,
        userId,
        hours,
        note: description,
        loggedAt: date ? new Date(date) : new Date(),
      },
    });
  }

  async findByTask(taskId: string) {
    return this.prisma.timeLog.findMany({
      where: { taskId },
      orderBy: { loggedAt: 'desc' },
      include: { user: { select: userSelect } },
    });
  }
}
