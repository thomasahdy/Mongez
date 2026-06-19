import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async createActivity(userId: string, taskId: string | null, type: string, data: any) {
    try {
      return await this.prisma.activity.create({
        data: {
          userId,
          taskId,
          type,
          data: data || {},
        },
      });
    } catch (err) {
      console.error('Failed to write activity:', err);
    }
  }

  async getSpaceActivity(spaceId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    return this.prisma.activity.findMany({
      where: {
        OR: [
          // 1. Task belongs to a board in this space
          { task: { board: { department: { spaceId } } } },
          // 2. Or spaceId is stored inside custom data
          { data: { path: ['spaceId'], equals: spaceId } }
        ]
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async getBoardActivity(boardId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    return this.prisma.activity.findMany({
      where: {
        OR: [
          { task: { boardId } },
          { data: { path: ['boardId'], equals: boardId } }
        ]
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }
}
