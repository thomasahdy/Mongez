import { Injectable, ForbiddenException } from '@nestjs/common';
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

      const identifier = await identifierService.nextIdentifier(spaceId, prefix);
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
    const before = await this.prisma.task.findUnique({ where: { id } });
    const task = await this.prisma.task.update({ where: { id }, data: dto, include: this.TASK_INCLUDE });

    const changed = Object.keys(dto).filter((k) => (before as any)[k] !== (dto as any)[k]);
    if (changed.length) {
      await this.prisma.taskJournal.createMany({
        data: changed.map((field) => ({
          taskId: id,
          changes: { field, from: String((before as any)[field] ?? ''), to: String((dto as any)[field] ?? '') },
          userId,
        })),
      });
    }

    return task;
  }

  async move(id: string, dto: MoveTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { columnId: dto.columnId, position: { gte: dto.position } },
        data: { position: { increment: 1 } },
      });
      return tx.task.update({
        where: { id },
        data: { columnId: dto.columnId, position: dto.position },
        include: this.TASK_INCLUDE,
      });
    });
  }

  async archive(id: string) {
    return this.prisma.task.update({ where: { id }, data: { isArchived: true } });
  }

  async search(query: string, spaceId: string, skip: number, limit: number) {
    const where: Prisma.TaskWhereInput = {
      board: { department: { spaceId } },
      isArchived: false,
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ]
      }),
    };

    const limitNum = Number(limit || 50);
    const skipNum = Number(skip || 0);
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({ where, skip: skipNum, take: limitNum, include: this.TASK_INCLUDE }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total };
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

  async create(taskId: string, authorId: string, content: string) {
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
