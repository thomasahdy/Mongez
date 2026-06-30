import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { redactPrivateIp } from '../../../common/security/ip-redaction.util';

@Injectable()
export class SessionService {
  private readonly MAX_SESSIONS_PER_USER = 5; // Maximum active sessions per user
  private readonly SESSION_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if user can create a new session (not exceeded limit)
   */
  async canCreateSession(userId: string): Promise<boolean> {
    const activeCount = await this.prisma.userSession.count({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return activeCount < this.MAX_SESSIONS_PER_USER;
  }

  /**
   * Create a new session and enforce session limits
   */
  async createSession(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    metadata?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    // Check if user can create a new session
    const canCreate = await this.canCreateSession(userId);
    if (!canCreate) {
      // Remove the oldest session to make room for the new one
      await this.removeOldestSession(userId);
    }

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        expiresAt,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
      },
    });
  }

  /**
   * Remove the oldest session for a user
   */
  private async removeOldestSession(userId: string): Promise<void> {
    const oldestSession = await this.prisma.userSession.findFirst({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (oldestSession) {
      await this.prisma.userSession.delete({
        where: {
          id: oldestSession.id,
        },
      });
    }
  }

  /**
   * Remove all sessions except the current one (used for login from new device)
   */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        userId,
        id: {
          not: currentSessionId,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Remove all sessions for a user (used for logout all devices)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        userId,
      },
    });

    return result.count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        ip: true,
        userAgent: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      ip: redactPrivateIp(session.ip),
    }));
  }

  /**
   * Validate a session
   */
  async validateSession(sessionId: string, refreshToken: string): Promise<boolean> {
    const session = await this.prisma.userSession.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      return false;
    }

    if (session.expiresAt < new Date()) {
      return false;
    }

    if (session.refreshToken !== refreshToken) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired sessions (can be called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get session count for a user
   */
  async getSessionCount(userId: string): Promise<number> {
    return this.prisma.userSession.count({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }
}
