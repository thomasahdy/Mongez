import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { BaseEvent } from '../core/contracts/event.contracts';
import { EmailChannel } from '../channels/email.channel';
import { WebSocketChannel } from '../channels/websocket.channel';
import { WhatsAppChannel } from '../../messaging/channels/whatsapp.channel';
import { TelegramChannel } from '../../messaging/channels/telegram.channel';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { randomUUID } from 'crypto';
import { NotificationPreferenceService } from '../../messaging/notifications/notification-preference.service';
import { MessagingAnalyticsService } from '../../messaging/analytics/messaging-analytics.service';
import { renderNotification, normalizeLang } from '../../messaging/templates/messaging-i18n';
import { NotificationChannelType } from '@prisma/client';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly emailChannel: EmailChannel,
    private readonly webSocketChannel: WebSocketChannel,
    private readonly whatsappChannel: WhatsAppChannel,
    private readonly telegramChannel: TelegramChannel,
    private readonly presenceService: PresenceService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferenceService: NotificationPreferenceService,
    private readonly messagingAnalytics: MessagingAnalyticsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
    private readonly traceContext: TraceContextService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    console.log(`[NotificationProcessor DEBUG] Processing job ID: ${job.id}, Name: ${job.name}`);
    const correlationId = job.data?.correlationId || randomUUID();

    return this.traceContext.run(correlationId, async () => {
      if (job.name === 'process_event') {
        console.log(`[NotificationProcessor DEBUG] Routing to handleProcessEvent for job ID: ${job.id}`);
        await this.handleProcessEvent(job);
      } else if (job.name === 'process_digest') {
        await this.handleProcessDigest(job);
      }
    });
  }

  async handleProcessEvent(job: Job<{
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: BaseEvent;
  }>) {
    const event = job.data;
    
    // Safety check in case payload is missing or not cast correctly
    if (!event.payload || !event.payload.eventId) {
      this.logger.warn(`Event ${event.id} missing payload.eventId, skipping idempotency check.`);
      return;
    }

    const { eventId } = event.payload;

    // 1. Idempotency Check
    const idempotencyKey = `idempotency:notification:${eventId}`;
    const alreadyProcessed = await this.cacheService.exists(idempotencyKey);
    if (alreadyProcessed) {
      this.logger.warn(`Skipping duplicate event ${eventId}`);
      return; // Acknowledge job successfully
    }

    try {
      const userIds: string[] = event.payload['assigneeIds'] || [];
      if (!userIds.length) {
        const singleUserId = event.payload['assigneeId'] || event.payload['userId'] || 'system';
        userIds.push(singleUserId);
      }
      console.log(`[NotificationProcessor DEBUG] Processing user IDs: ${JSON.stringify(userIds)}`);

      for (const userId of userIds) {
        await this.processSingleNotification(userId, event);
      }

      // 2. Mark Idempotency (TTL 24 hours)
      await this.cacheService.set(idempotencyKey, true, 86400);
      
    } catch (error) {
      console.log(`[NotificationProcessor DEBUG] Error in handleProcessEvent:`, error);
      this.logger.error(`Failed to process event ${eventId}`, error);
      throw error; // Throwing will cause BullMQ to retry
    }
  }

  private async processSingleNotification(userId: string, event: any) {
    const spaceId = event.payload.spaceId || '';
    const eventId = event.payload.eventId;
    const eventType = event.eventType;
    const priority = (event.payload.priority || 'NORMAL') as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

    // Check presence
    const isOnline = await this.presenceService.isUserOnline(userId);
    console.log(`[NotificationProcessor DEBUG] User: ${userId}, isOnline: ${isOnline}, priority: ${priority}`);

    // Resolve enabled channels from user preferences
    const enabledChannels = await this.notificationPreferenceService.getEnabledChannels(
      userId,
      eventType,
      priority,
    );
    console.log(`[NotificationProcessor DEBUG] Enabled channels for ${eventType}:`, enabledChannels);

    // Apply presence suppression: if online and not CRITICAL, suppress WhatsApp/Telegram
    const targetChannels = enabledChannels.filter((ch) => {
      if (ch === 'whatsapp' || ch === 'telegram') {
        // Suppress mobile messaging when user is active in-app — UNLESS critical
        return !isOnline || priority === 'CRITICAL';
      }
      return true;
    });
    console.log(`[NotificationProcessor DEBUG] Target channels after presence filter:`, targetChannels);

    // Always include IN_APP as a fallback if no channels enabled
    const finalChannels = targetChannels.length > 0 ? targetChannels : ['inApp'];

    // Get user language preference
    const userPref = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { language: true },
    });
    const lang = normalizeLang(userPref?.language);

    // Build localized notification content
    const rendered = renderNotification(eventType, lang, {
      title: event.payload.title || null,
      body: event.payload.body || null,
      actorName: event.payload.actorName || null,
      entityLabel: event.payload.entityLabel || null,
      taskIdentifier: event.payload.taskIdentifier || null,
      dueDate: event.payload.dueDate || null,
      boardName: event.payload.boardName || null,
    });

    const title = rendered.title || (lang === 'ar' ? 'منجز' : 'Mongez');
    const body = rendered.body || '';

    if (finalChannels.includes('inApp')) {
      // Create and send in-app notification
      const notification = await this.notificationsService.createAndNotify({
        userId,
        spaceId,
        type: eventType,
        channel: 'IN_APP',
        priority,
        title,
        body,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        metadata: event.payload,
      });

      await this.webSocketChannel.send(notification, event.payload);

      // Record analytics for IN_APP
      await this.messagingAnalytics.record('SENT', {
        notificationId: notification.id,
        userId,
        spaceId,
        channel: 'IN_APP',
        eventType,
        metadata: { source: 'processor' },
      });
    }

    // Fan out to messaging channels (WhatsApp/Telegram)
    const messagingChannels = finalChannels.filter((ch) => ch === 'whatsapp' || ch === 'telegram');
    if (messagingChannels.length > 0) {
      // Create a lightweight notification shape for messaging
      const pseudoNotification = {
        id: `evt-${eventId}`,
        userId,
        spaceId,
        type: eventType,
        priority,
        channel: 'WHATSAPP',
        title,
        body,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        status: 'QUEUED',
        metadata: event.payload,
        templateVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.fanOutToMessaging(pseudoNotification as any, event.payload, messagingChannels);
    }

    // Queue email digest if offline and email is enabled
    if (!isOnline && finalChannels.includes('email')) {
      const aggregationGroup = `digest_${userId}_${event.aggregateType}_${event.aggregateId}`;

      await this.notificationQueue.add('process_digest', {
        userId,
        spaceId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        group: aggregationGroup,
        eventType,
        title,
        body,
      }, {
        jobId: `digest-job-${aggregationGroup}`,
        delay: 300000, // 5 minutes delay
        removeOnComplete: true,
      });

      // Save the event payload to the digest list
      const redis = (this.cacheService as any).redis;
      if (redis) {
        await redis.rpush(aggregationGroup, JSON.stringify({
          id: `notif-${eventId}`,
          userId,
          type: eventType,
          title,
          body,
        }));
        await redis.expire(aggregationGroup, 86400);
      }
    }
  }

  /**
   * Push the notification to WhatsApp and/or Telegram in parallel. Each channel
   * is independent and silently skips when the recipient has no registered /
   * opted-in contact or no provider account is configured (dev fallback).
   *
   * @param notification Notification payload
   * @param payload Event payload
   * @param targetChannels List of channels to use (e.g. ['whatsapp', 'telegram'])
   */
  private async fanOutToMessaging(
    notification: any,
    payload: BaseEvent,
    targetChannels: string[] = ['whatsapp', 'telegram'],
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    if (targetChannels.includes('whatsapp')) {
      promises.push(
        this.whatsappChannel.send(notification, payload).then((result) => {
          if (result) {
            // Record analytics for WhatsApp
            this.messagingAnalytics.record('SENT', {
              notificationId: notification.id,
              userId: notification.userId,
              spaceId: notification.spaceId,
              channel: 'WHATSAPP',
              eventType: notification.type,
              metadata: { source: 'processor' },
            }).catch(() => {}); // Fire and forget
          }
          return result;
        })
      );
    }

    if (targetChannels.includes('telegram')) {
      promises.push(
        this.telegramChannel.send(notification, payload).then((result) => {
          if (result) {
            // Record analytics for Telegram
            this.messagingAnalytics.record('SENT', {
              notificationId: notification.id,
              userId: notification.userId,
              spaceId: notification.spaceId,
              channel: 'TELEGRAM',
              eventType: notification.type,
              metadata: { source: 'processor' },
            }).catch(() => {}); // Fire and forget
          }
          return result;
        })
      );
    }

    await Promise.allSettled(promises);
  }

  async handleProcessDigest(job: Job<{ userId: string, spaceId: string, aggregateType: string, aggregateId: string, group: string }>) {
    const { userId, spaceId, aggregateType, aggregateId, group } = job.data;
    this.logger.log(`Processing digest for group ${group}`);

    const redis = (this.cacheService as any).redis;
    if (!redis) return;

    // Pop all events from the list
    const rawEvents = await redis.lrange(group, 0, -1);
    await redis.del(group);

    if (!rawEvents || rawEvents.length === 0) return;

    const notifications = rawEvents.map(e => JSON.parse(e));
    
    // Persist the Digest notification
    const digestNotification = await this.notificationsService.createAndNotify({
      userId,
      spaceId,
      type: 'DIGEST',
      channel: 'EMAIL',
      priority: 'NORMAL',
      title: `${notifications.length} updates on ${aggregateType}`,
      body: `You have ${notifications.length} new updates regarding ${aggregateType} ${aggregateId}.`,
      entityType: aggregateType,
      entityId: aggregateId,
      metadata: { count: notifications.length, group },
    });

    // Dispatch the single digest email
    await this.emailChannel.send(digestNotification, { eventId: digestNotification.id } as any);
  }
}
