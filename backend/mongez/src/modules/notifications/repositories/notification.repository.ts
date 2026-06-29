import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma, NotificationChannelType, NotificationPriority } from '@prisma/client';
import { NotificationFilterDto } from '../dto/notification-filter.dto';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(userId: string, spaceId: string, filters: NotificationFilterDto) {
    const { page, limit, type, status } = filters;
    const pageNum = Number(page || 1);
    const limitNum = Number(limit || 50);
    const skip = (pageNum - 1) * limitNum;
    
    const where: Prisma.NotificationWhereInput = {
      userId,
      spaceId,
      ...(type && { type }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total };
  }

  async countUnread(userId: string, spaceId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        spaceId,
        status: { not: 'READ' },
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: {
        readAt: new Date(),
        status: 'READ',
      },
    });
  }

  async markAllAsRead(userId: string, spaceId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        spaceId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
        status: 'READ',
      },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.delete({ where: { id, userId } });
  }

  async create(data: {
    userId: string;
    spaceId: string;
    type: string;
    channel: NotificationChannelType;
    priority?: NotificationPriority;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  }
}
