import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationRepository } from './repositories/notification.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { RealtimeService } from '../realtime/realtime.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { paginate } from '../../shared/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  private readonly COUNT_CACHE_TTL = 30;

  constructor(
    private readonly notifRepo: NotificationRepository,
    private readonly cache: CacheService,
    private readonly realtimeService: RealtimeService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {}

  async getForUser(userId: string, spaceId: string, filters: NotificationFilterDto) {
    const { data, total } = await this.notifRepo.findForUser(userId, spaceId, filters);
    return paginate(data, total, filters.page, filters.limit);
  }

  async getUnreadCount(userId: string, spaceId: string): Promise<number> {
    return this.cache.getOrSet(
      `notif:count:${userId}:${spaceId}`,
      () => this.notifRepo.countUnread(userId, spaceId),
      this.COUNT_CACHE_TTL,
    );
  }

  async markAsRead(id: string, userId: string, spaceId: string) {
    const notif = await this.notifRepo.markAsRead(id, userId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:read', { id });
    return notif;
  }

  async markAllAsRead(userId: string, spaceId: string) {
    await this.notifRepo.markAllAsRead(userId, spaceId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:read', { all: true });
  }

  async delete(id: string, userId: string, spaceId: string) {
    await this.notifRepo.delete(id, userId);
    await this.cache.del(`notif:count:${userId}:${spaceId}`);
    await this.pushCountUpdate(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:deleted', { id });
  }

  // Called by the BullMQ processor — creates notification + pushes via WebSocket
  async createAndNotify(data: Parameters<NotificationRepository['create']>[0]) {
    const notif = await this.notifRepo.create(data);
    await this.cache.del(`notif:count:${data.userId}:${data.spaceId}`);
    // Push new notification to user's private room
    this.realtimeService.emitToUser(data.userId, 'notification:new', notif);
    await this.pushCountUpdate(data.userId, data.spaceId);
    return notif;
  }

  private async pushCountUpdate(userId: string, spaceId: string) {
    const count = await this.notifRepo.countUnread(userId, spaceId);
    this.realtimeService.emitToUser(userId, 'notification:count', { unread: count, spaceId });
  }

  async queueNotification(data: {
    userId: string;
    spaceId: string;
    type: string;
    channel: 'IN_APP' | 'PUSH' | 'EMAIL';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
  }) {
    await this.notificationQueue.add(JOB_NAMES.SEND_NOTIFICATION, data);
  }
}