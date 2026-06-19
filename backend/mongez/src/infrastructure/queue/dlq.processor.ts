import { QueueEventsListener, QueueEventsHost, OnQueueEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from './queue.constants';

@QueueEventsListener(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsQueueEventsListener extends QueueEventsHost {
  private readonly logger = new Logger('NotificationsDLQListener');

  @OnQueueEvent('failed')
  onQueueFailed(jobId: string, failedReason: string) {
    this.logger.error(
      JSON.stringify({
        event: 'DLQ_JOB_FAILED',
        queue: QUEUE_NAMES.NOTIFICATIONS,
        jobId,
        failedReason,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

@QueueEventsListener(QUEUE_NAMES.AI_PROCESSING)
export class AIProcessingQueueEventsListener extends QueueEventsHost {
  private readonly logger = new Logger('AIProcessingDLQListener');

  @OnQueueEvent('failed')
  onQueueFailed(jobId: string, failedReason: string) {
    this.logger.error(
      JSON.stringify({
        event: 'DLQ_JOB_FAILED',
        queue: QUEUE_NAMES.AI_PROCESSING,
        jobId,
        failedReason,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
