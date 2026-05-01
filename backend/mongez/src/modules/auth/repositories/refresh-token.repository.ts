import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface RefreshTokenData {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: RefreshTokenData): Promise<void> {
    await this.prisma.userSession.create({
      data,
    });
  }

  async findByToken(token: string): Promise<any | null> {
    return this.prisma.userSession.findUnique({
      where: { refreshToken: token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<any[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revokeToken(token: string): Promise<void> {
    await this.prisma.userSession.delete({
      where: { refreshToken: token },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  async isTokenValid(token: string): Promise<boolean> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: token },
    });

    if (!session) {
      return false;
    }

    if (session.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async cleanupOldTokens(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async countActiveTokens(userId: string): Promise<number> {
    return this.prisma.userSession.count({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async getUserActiveTokens(userId: string): Promise<any[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        refreshToken: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}