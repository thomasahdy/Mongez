import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { BaseEvent } from '../core/contracts/event.contracts';
import { EmailChannel } from '../channels/email.channel';
import { WebSocketChannel } from '../channels/websocket.channel';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly emailChannel: EmailChannel,
    private readonly webSocketChannel: WebSocketChannel,
    private readonly presenceService: PresenceService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === 'process_event') {
      await this.handleProcessEvent(job);
    } else if (job.name === 'process_digest') {
      await this.handleProcessDigest(job);
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

      for (const userId of userIds) {
        await this.processSingleNotification(userId, event);
      }

      // 2. Mark Idempotency (TTL 24 hours)
      await this.cacheService.set(idempotencyKey, true, 86400);
      
    } catch (error) {
      this.logger.error(`Failed to process event ${eventId}`, error);
      throw error; // Throwing will cause BullMQ to retry
    }
  }

  private async processSingleNotification(userId: string, event: any) {
    const spaceId = event.payload.spaceId || '';
    const eventId = event.payload.eventId;

    // Phase 5: Presence-Aware Routing & Aggregation
    const isOnline = await this.presenceService.isUserOnline(userId);

    if (isOnline) {
      // User is active! Persist and send instantly via WebSocket.
      this.logger.log(`User ${userId} is ONLINE. Routing to WebSocket only.`);
      
      const notification = await this.notificationsService.createAndNotify({
        userId,
        spaceId,
        type: event.eventType,
        channel: 'IN_APP',
        priority: 'NORMAL',
        title: `System Alert: ${event.eventType}`,
        body: `Event occurred on ${event.aggregateType} ${event.aggregateId}`,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        metadata: event.payload,
      });

      await this.webSocketChannel.send(notification, event.payload);
    } else {
      // User is offline. Push to aggregation queue.
      this.logger.log(`User ${userId} is OFFLINE. Queuing for aggregation.`);
      
      const aggregationGroup = `digest_${userId}_${event.aggregateType}_${event.aggregateId}`;
      
      await this.notificationQueue.add('process_digest', {
        userId,
        spaceId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        group: aggregationGroup
      }, {
        jobId: `digest-job-${aggregationGroup}`, // Deduplication key
        delay: 300000, // 5 minutes delay
        removeOnComplete: true,
      });

      // Save the event payload to the digest list
      const redis = (this.cacheService as any).redis;
      if (redis) {
        await redis.rpush(aggregationGroup, JSON.stringify({
          id: `notif-${eventId}`,
          userId,
          type: event.eventType,
          title: `System Alert: ${event.eventType}`,
          body: `Event occurred on ${event.aggregateType} ${event.aggregateId}`,
        }));
        await redis.expire(aggregationGroup, 86400); // 24h TTL
      }
    }
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
