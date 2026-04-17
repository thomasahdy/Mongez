import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationRepository } from './notification.repository';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationRepo: NotificationRepository) {
    super();
  }

  async process(job: Job<any, any, string>) {
    this.logger.log(`Processing notification job: ${job.name}`);

    switch (job.name) {
      case JOB_NAMES.SEND_NOTIFICATION:
        await this.handleSendNotification(job.data);
        break;
      case JOB_NAMES.BULK_NOTIFY:
        await this.handleBulkNotify(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }) {
    await this.notificationRepo.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
    });

    // TODO: Add real-time push via WebSocket
    this.logger.log(`Notification created for user ${data.userId}: ${data.title}`);
  }

  private async handleBulkNotify(data: { userIds: string[]; type: string; title: string; message: string }) {
    const notifications = data.userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
    }));

    // Batch create
    for (const notification of notifications) {
      await this.notificationRepo.create(notification);
    }

    this.logger.log(`Bulk notifications sent to ${data.userIds.length} users`);
  }
}