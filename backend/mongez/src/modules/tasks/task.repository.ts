import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

const userSelect = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: { include: { user: { select: userSelect } } },
        comments: { take: 5, orderBy: { createdAt: 'desc' }, include: { user: { select: userSelect } } },
        dependencies: true,
        _count: { select: { comments: true, attachments: true, subtasks: true } },
      },
    });
  }

  async findByBoardId(boardId: string, filters?: { status?: string; assigneeId?: string; priority?: string }, page = 1, limit = 50) {
    const where: Prisma.TaskWhereInput = {
      boardId,
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.assigneeId && { assignments: { some: { userId: filters.assigneeId } } }),
      ...(filters?.priority && { priority: filters.priority as any }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          position: true,
          createdAt: true,
          updatedAt: true,
          assignments: { include: { user: { select: userSelect } } },
          _count: { select: { comments: true, attachments: true, subtasks: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit };
  }

  async create(data: Prisma.TaskCreateInput) {
    return this.prisma.task.create({ data });
  }

  async update(id: string, data: Prisma.TaskUpdateInput) {
    return this.prisma.task.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}