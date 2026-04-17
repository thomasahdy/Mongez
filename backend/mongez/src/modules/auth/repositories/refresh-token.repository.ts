import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface RefreshTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: RefreshTokenData): Promise<void> {
    await this.prisma.refreshToken.create({
      data,
    });
  }

  async findByToken(token: string): Promise<any | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<any[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
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
    await this.prisma.refreshToken.update({
      where: { token },
      data: {
        isRevoked: true,
      },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });
  }

  async isTokenValid(token: string): Promise<boolean> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken) {
      return false;
    }

    if (refreshToken.isRevoked) {
      return false;
    }

    if (refreshToken.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async cleanupRevokedTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        isRevoked: true,
      },
    });

    return result.count;
  }

  async cleanupOldTokens(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: cutoffDate,
            },
          },
          {
            isRevoked: true,
            createdAt: {
              lt: cutoffDate,
            },
          },
        ],
      },
    });

    return result.count;
  }

  async countActiveTokens(userId: string): Promise<number> {
    return this.prisma.refreshToken.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async getUserActiveTokens(userId: string): Promise<any[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}