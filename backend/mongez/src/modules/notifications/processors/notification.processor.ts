import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
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
    const correlationId = job.data?.correlationId || randomUUID();

    return this.traceContext.run(correlationId, async () => {
      if (job.name === 'process_event') {
        await this.handleProcessEvent(job);
      } else if (job.name === 'process_digest') {
        await this.handleProcessDigest(job);
      } else if (job.name === JOB_NAMES.SEND_NOTIFICATION) {
        await this.handleSendNotification(job);
      }
    });
  }

  async handleSendNotification(job: Job<{
    userId: string;
    spaceId: string;
    type: string;
    channel: 'IN_APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'TELEGRAM';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
  }>) {
    const data = job.data;
    const userId = data.userId;
    const priority = data.priority || 'NORMAL';

    this.logger.log(`Handling send-notification: userId=${userId}, type=${data.type}, channel=${data.channel}`);

    // Verify user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      this.logger.warn(`User ${userId} does not exist. Skipping notification.`);
      return;
    }

    const title = data.title;
    const body = data.body;
    const spaceId = data.spaceId;
    const eventType = data.type;

    if (data.channel === 'IN_APP') {
      const notification = await this.notificationsService.createAndNotify({
        userId,
        spaceId,
        type: eventType,
        channel: 'IN_APP',
        priority,
        title,
        body,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
      });

      await this.messagingAnalytics.record('SENT', {
        notificationId: notification.id,
        userId,
        spaceId,
        channel: 'IN_APP',
        eventType,
        metadata: { source: 'direct-queue' },
      });
    } else if (data.channel === 'EMAIL') {
      const notification = await this.notificationsService.createAndNotify({
        userId,
        spaceId,
        type: eventType,
        channel: 'EMAIL',
        priority,
        title,
        body,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
      });
      await this.emailChannel.send(notification, { eventId: notification.id } as any);
    } else if (data.channel === 'WHATSAPP' || data.channel === 'TELEGRAM') {
      const pseudoNotification = {
        id: `evt-direct-${Date.now()}`,
        userId,
        spaceId,
        type: eventType,
        priority,
        channel: data.channel,
        title,
        body,
        entityType: data.entityType,
        entityId: data.entityId,
        status: 'QUEUED',
        metadata: data.metadata,
        templateVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.fanOutToMessaging(pseudoNotification as any, {} as any, [data.channel.toLowerCase()]);
    }
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

    try {
      const userIds: string[] = event.payload['assigneeIds'] || [];
      if (!userIds.length) {
        const singleUserId = event.payload['assigneeId'] || event.payload['userId'] || 'system';
        userIds.push(singleUserId);
      }

      for (const userId of userIds) {
        // Track idempotency per user to prevent duplicate sends on partial failure retries
        const userIdempotencyKey = `idempotency:notification:${eventId}:${userId}`;
        const alreadyProcessed = await this.cacheService.exists(userIdempotencyKey);
        if (alreadyProcessed) {
          this.logger.log(`Skipping duplicate event ${eventId} for user ${userId}`);
          continue;
        }

        await this.processSingleNotification(userId, event);

        // Mark this user as processed immediately
        await this.cacheService.set(userIdempotencyKey, true, 86400);
      }

      // Mark the event as globally processed
      const idempotencyKey = `idempotency:notification:${eventId}`;
      await this.cacheService.set(idempotencyKey, true, 86400);

    } catch (error) {
      this.logger.error(`Failed to process event ${eventId}`, error);
      throw error; // Throwing will cause BullMQ to retry
    }
  }

  private async processSingleNotification(userId: string, event: any) {
    // Verify user exists to prevent foreign key violations (e.g. for 'system' placeholder)
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      this.logger.warn(`User ${userId} does not exist. Skipping notification.`);
      return;
    }

    let eventType = event.eventType;
    // Normalize event type names (e.g. task.assigned -> TASK_ASSIGNED)
    if (eventType) {
      eventType = eventType.toUpperCase().replace(/\./g, '_');
      if (eventType === 'TASK_CREATED') {
        eventType = 'TASK_ASSIGNED';
      }
    }

    const spaceId = event.payload.spaceId || '';
    const eventId = event.payload.eventId;
    const priority = (event.payload.priority || 'NORMAL') as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

    // Check presence
    const isOnline = await this.presenceService.isUserOnline(userId);

    // Resolve enabled channels from user preferences
    const enabledChannels = await this.notificationPreferenceService.getEnabledChannels(
      userId,
      eventType,
      priority,
    );

    // Apply presence suppression: if online and not CRITICAL, suppress WhatsApp/Telegram
    const targetChannels = enabledChannels.filter((ch) => {
      if (ch === 'whatsapp' || ch === 'telegram') {
        // Suppress mobile messaging when user is active in-app — UNLESS critical
        return !isOnline || priority === 'CRITICAL';
      }
      return true;
    });

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
      await this.cacheService.rpush(aggregationGroup, JSON.stringify({
        id: `notif-${eventId}`,
        userId,
        type: eventType,
        title,
        body,
      }));
      await this.cacheService.expire(aggregationGroup, 86400);
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

    // Pop all events from the list
    const rawEvents = await this.cacheService.lrange(group, 0, -1);
    await this.cacheService.del(group);

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
