import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OutboxRepository } from './outbox.repository';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isProcessing = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleOutboxRelay() {
    if (this.isProcessing) return; // Prevent concurrent cron overlaps
    this.isProcessing = true;

    try {
      const events = await this.outboxRepository.getUnprocessedEvents(50);
      
      await Promise.all(
        events.map(async (event) => {
          try {
            // Push to BullMQ. We pass the whole event object.
            await this.notificationQueue.add('process_event', event, {
              jobId: event.id, // BullMQ native deduplication key
              removeOnComplete: true,
              attempts: 3,
              backoff: { type: 'exponential', delay: 5000 },
            });

            // Mark as processed in Postgres
            await this.outboxRepository.markAsProcessed(event.id);
          } catch (error) {
            this.logger.error(`Failed to relay OutboxEvent ${event.id}`, error);
            // Revert status to PENDING so it can be retried on subsequent ticks
            await this.outboxRepository.revertToPending(event.id);
          }
        })
      );
    } catch (error) {
      this.logger.error('Error in OutboxRelay loop', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
