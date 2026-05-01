import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface UserLogData {
  userId: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UserLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: UserLogData): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: 'user',
        entityId: data.userId,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findByUser(userId: string, options?: {
    skip?: number;
    take?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const { skip, take, action, startDate, endDate } = options || {};

    const where: any = { userId };

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async findByAction(action: string, options?: {
    skip?: number;
    take?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const { skip, take, startDate, endDate } = options || {};

    const where: any = { action };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async findFailedLoginAttempts(userId: string, since?: Date): Promise<any[]> {
    const where: any = {
      userId,
      action: 'LOGIN_FAIL',
    };

    if (since) {
      where.timestamp = {
        gte: since,
      };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async findRecentLoginAttempts(userId: string, minutes: number = 30): Promise<any[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return this.prisma.auditLog.findMany({
      where: {
        userId,
        action: {
          in: ['LOGIN_SUCCESS', 'LOGIN_FAIL'],
        },
        timestamp: {
          gte: since,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
  }

  async getLoginStats(userId: string, days: number = 30): Promise<{
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    lastLogin?: Date;
    lastFailedLogin?: Date;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        action: {
          in: ['LOGIN_SUCCESS', 'LOGIN_FAIL'],
        },
        timestamp: {
          gte: startDate,
        },
      },
    });

    const successfulLogins = logs.filter(log => log.action === 'LOGIN_SUCCESS');
    const failedLogins = logs.filter(log => log.action === 'LOGIN_FAIL');

    const lastLogin = successfulLogins.length > 0
      ? successfulLogins[0].timestamp
      : undefined;

    const lastFailedLogin = failedLogins.length > 0
      ? failedLogins[0].timestamp
      : undefined;

    return {
      totalLogins: logs.length,
      successfulLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      lastLogin,
      lastFailedLogin,
    };
  }
}