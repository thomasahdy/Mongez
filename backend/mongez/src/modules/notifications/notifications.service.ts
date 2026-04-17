import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationRepository } from './notification.repository';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {}

  async getUserNotifications(userId: string, page?: number, limit?: number) {
    return this.notificationRepo.findByUserId(userId, page, limit);
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepo.findUnreadCount(userId);
  }

  async markAsRead(id: string) {
    return this.notificationRepo.markAsRead(id);
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepo.markAllAsRead(userId);
  }

  /**
   * Queue a notification for async processing
   */
  async queueNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }) {
    await this.notificationQueue.add(JOB_NAMES.SEND_NOTIFICATION, data);
  }
}