import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [dau, mau, totalAIRequests, storageAggregation] = await Promise.all([
      this.prisma.user.count({
        where: { lastLoginAt: { gte: oneDayAgo } },
      }),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.aiRequest.count(),
      this.prisma.fileVersion.aggregate({
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    return {
      dau,
      mau,
      totalAIRequests,
      storageUsedBytes: storageAggregation._sum.fileSize != null ? Number(storageAggregation._sum.fileSize) : 0,
    };
  }

  async listUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { users, total };
  }

  async listSpaces(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              departments: true,
              memberships: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.space.count(),
    ]);

    return { spaces, total };
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.SUSPENDED },
      }),
      // Revoke all active sessions
      this.prisma.userSession.deleteMany({
        where: { userId },
      }),
    ]);

    return { message: 'User suspended successfully' };
  }

  async deleteSpace(spaceId: string) {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // Rely on cascade deletion mapped in schema, or delete directly
    await this.prisma.space.delete({
      where: { id: spaceId },
    });

    return { message: 'Space deleted successfully' };
  }
}
