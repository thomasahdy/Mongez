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
    await this.prisma.userLog.create({
      data,
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
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    return this.prisma.userLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
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
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    return this.prisma.userLog.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findFailedLoginAttempts(userId: string, since?: Date): Promise<any[]> {
    const where: any = {
      userId,
      action: 'LOGIN_FAIL',
    };

    if (since) {
      where.createdAt = {
        gte: since,
      };
    }

    return this.prisma.userLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findRecentLoginAttempts(userId: string, minutes: number = 30): Promise<any[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return this.prisma.userLog.findMany({
      where: {
        userId,
        action: {
          in: ['LOGIN_SUCCESS', 'LOGIN_FAIL'],
        },
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    await this.prisma.userLog.deleteMany({
      where: {
        createdAt: {
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

    const logs = await this.prisma.userLog.findMany({
      where: {
        userId,
        action: {
          in: ['LOGIN_SUCCESS', 'LOGIN_FAIL'],
        },
        createdAt: {
          gte: startDate,
        },
      },
    });

    const successfulLogins = logs.filter(log => log.action === 'LOGIN_SUCCESS');
    const failedLogins = logs.filter(log => log.action === 'LOGIN_FAIL');

    const lastLogin = successfulLogins.length > 0 
      ? successfulLogins[0].createdAt 
      : undefined;
    
    const lastFailedLogin = failedLogins.length > 0 
      ? failedLogins[0].createdAt 
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