import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * MessagingAuditService — Writes audit logs for chat-based actions.
 *
 * When users perform actions via WhatsApp/Telegram (approve, complete task, etc.),
 * this service writes both AuditLog and Activity rows to maintain a complete
 * audit trail with channel attribution.
 *
 * This ensures all actions are traceable regardless of the source (web app,
 * WhatsApp, Telegram, etc.).
 */
@Injectable()
export class MessagingAuditService {
  private readonly logger = new Logger(MessagingAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an action performed via a messaging channel.
   *
   * @param payload Action details
   */
  async recordAction(payload: {
    userId: string;
    spaceId: string;
    action: string;
    entityType: string;
    entityId: string;
    channel: 'WHATSAPP' | 'TELEGRAM';
    diff?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const { userId, spaceId, action, entityType, entityId, channel, diff, ipAddress } = payload;

      // Write AuditLog
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          diff: diff as any,
          ipAddress: ipAddress || null,
          timestamp: new Date(),
        },
      });

      // Write Activity (for in-app activity feed)
      const actionText = this.getActionText(action, channel);
      await this.prisma.activity.create({
        data: {
          userId,
          taskId: entityType === 'task' ? entityId : null,
          type: action,
          data: {
            spaceId,
            entityType,
            entityId,
            source: 'messaging',
            channel,
            actionText,
            ...diff,
          } as any,
        },
      });

      this.logger.debug(
        `Audit recorded: ${action} on ${entityType}:${entityId} by ${userId} via ${channel}`,
      );
    } catch (error) {
      // Don't throw — audit failures shouldn't block the action
      this.logger.error(`Failed to write audit log:`, error);
    }
  }

  /**
   * Get human-readable action text with channel attribution.
   */
  private getActionText(action: string, channel: string): string {
    const channelEmoji = channel === 'WHATSAPP' ? '📱' : '💬';
    const channelName = channel === 'WHATSAPP' ? 'WhatsApp' : 'Telegram';

    const actionMap: Record<string, string> = {
      'task.completed': `completed via ${channelName}`,
      'task.created': `created via ${channelName}`,
      'task.updated': `updated via ${channelName}`,
      'workflow.approved': `approved via ${channelName}`,
      'workflow.rejected': `rejected via ${channelName}`,
      'workflow.cancelled': `cancelled via ${channelName}`,
    };

    return `${channelEmoji} ${actionMap[action] || action}`;
  }

  /**
   * Batch record multiple actions (useful for bulk operations).
   */
  async recordBatch(actions: Parameters<typeof this.recordAction>[0][]): Promise<void> {
    await Promise.all(actions.map((a) => this.recordAction(a)));
  }
}
