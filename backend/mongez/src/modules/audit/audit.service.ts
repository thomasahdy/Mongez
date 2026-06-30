import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditLogInput } from './dto/audit-log-input.dto';
import { TraceContextService } from '../../infrastructure/logging/trace-context.service';
import { redactPrivateIp } from '../../common/security/ip-redaction.util';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.ACTIVITY_LOG) private readonly auditQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly traceContext: TraceContextService,
  ) {}

  /**
   * Fire-and-forget audit log entry. Never blocks the calling service.
   * Payload is validated lightly before queueing.
   */
  log(input: AuditLogInput): void {
    if (!input?.userId || !input?.action || !input?.entityType || !input?.entityId) {
      this.logger.warn(`Invalid audit input dropped: ${JSON.stringify(input)}`);
      return;
    }
    const payload = { ...input, correlationId: this.traceContext.correlationId };
    this.auditQueue.add(JOB_NAMES.LOG_ACTIVITY, payload, { removeOnComplete: 500 }).catch((err) => {
      this.logger.error(`Failed to enqueue audit log: ${err.message}`);
    });
  }

  /**
   * Persist the audit log entry. Called by the queue processor.
   */
  async record(input: AuditLogInput): Promise<void> {
    try {
      // Guard against FK violation: user may have been deleted before the queued job runs
      const userExists = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!userExists) {
        this.logger.warn(`Skipping audit log for deleted user ${input.userId} (action: ${input.action})`);
        return;
      }

      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          diff: (input.diff ?? undefined) as any,
          ipAddress: input.ipAddress,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record audit log: ${(err as Error).message}`);
    }
  }

  /**
   * Persist user activity log. Called by the queue processor.
   */
  async recordUserActivity(data: any): Promise<void> {
    try {
      await this.prisma.userActivity.create({
        data: {
          userId: data.userId,
          action: data.action,
          feature: data.feature,
          spaceId: data.spaceId,
          metadata: data.metadata,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record user activity: ${(err as Error).message}`);
    }
  }

  /**
   * Query audit logs for a space (ADMIN only). Space-scoped via entity lookups.
   */
  async findBySpace(spaceId: string, options: { action?: string; entityType?: string; page?: number; limit?: number }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    // AuditLog has no direct spaceId; we scope by users who are members of the space.
    const memberIds = (
      await this.prisma.membership.findMany({
        where: { spaceId },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId: { in: memberIds },
        ...(options.action ? { action: options.action } : {}),
        ...(options.entityType ? { entityType: options.entityType } : {}),
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    });

    return this.redactPrivateIps(logs);
  }

  /**
   * Query audit logs for a specific user (their own activity).
   */
  async findByUser(userId: string, options: { action?: string; entityType?: string; page?: number; limit?: number }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        ...(options.action ? { action: options.action } : {}),
        ...(options.entityType ? { entityType: options.entityType } : {}),
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    });

    return this.redactPrivateIps(logs);
  }

  private redactPrivateIps<T extends { ipAddress?: string | null }>(logs: T[]): T[] {
    return logs.map((log) => ({
      ...log,
      ipAddress: redactPrivateIp(log.ipAddress),
    }));
  }
}
