import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationFunnelStage, NotificationChannelType } from '@prisma/client';

/**
 * MessagingAnalyticsService — Tracks notification funnel events.
 *
 * Records events at each stage of the notification lifecycle:
 * - SENT: Notification handed off to channel adapter
 * - DELIVERED: Channel confirms delivery (webhook callback or success response)
 * - OPENED: User opened the notification (deep link click or in-app read)
 * - ACTED_UPON: User took action (approved, completed task, etc.)
 * - EXPIRED: Approval expired without action
 *
 * Enables product decisions about channel effectiveness (WhatsApp vs Telegram vs Email).
 */
@Injectable()
export class MessagingAnalyticsService {
  private readonly logger = new Logger(MessagingAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a funnel event.
   *
   * @param stage Funnel stage
   * @param payload Event payload
   */
  async record(
    stage: NotificationFunnelStage,
    payload: {
      notificationId: string;
      userId: string;
      spaceId: string;
      channel: NotificationChannelType;
      eventType: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await this.prisma.notificationEvent.create({
        data: {
          notificationId: payload.notificationId,
          userId: payload.userId,
          spaceId: payload.spaceId,
          channel: payload.channel,
          eventType: payload.eventType,
          stage,
          metadata: payload.metadata as any,
        },
      });

      this.logger.debug(
        `Analytics: ${stage} for notification ${payload.notificationId} via ${payload.channel}`,
      );
    } catch (error) {
      // Don't throw — analytics failures shouldn't block notifications
      this.logger.error(`Failed to record analytics event:`, error);
    }
  }

  /**
   * Query funnel statistics for a space.
   *
   * @param spaceId Space ID
   * @param filters Optional filters (from, to, eventType)
   * @returns Funnel metrics per channel
   */
  async getFunnelMetrics(spaceId: string, filters?: {
    from?: Date;
    to?: Date;
    eventType?: string;
  }) {
    const where: any = { spaceId };

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    const events = await this.prisma.notificationEvent.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by channel and stage
    const metrics: Record<string, Record<NotificationFunnelStage, number>> = {};

    for (const event of events) {
      const channel = event.channel;
      if (!metrics[channel]) {
        metrics[channel] = {
          SENT: 0,
          DELIVERED: 0,
          OPENED: 0,
          ACTED_UPON: 0,
          EXPIRED: 0,
        };
      }
      metrics[channel][event.stage]++;
    }

    // Calculate conversion rates
    const result = Object.entries(metrics).map(([channel, stages]) => ({
      channel,
      ...stages,
      deliveredRate: stages.SENT > 0 ? (stages.DELIVERED / stages.SENT) * 100 : 0,
      openedRate: stages.DELIVERED > 0 ? (stages.OPENED / stages.DELIVERED) * 100 : 0,
      actedRate: stages.OPENED > 0 ? (stages.ACTED_UPON / stages.OPENED) * 100 : 0,
    }));

    return result;
  }

  /**
   * Get funnel breakdown for a specific notification.
   *
   * @param notificationId Notification ID
   * @returns All events for this notification, ordered by time
   */
  async getNotificationFunnel(notificationId: string) {
    return this.prisma.notificationEvent.findMany({
      where: { notificationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
