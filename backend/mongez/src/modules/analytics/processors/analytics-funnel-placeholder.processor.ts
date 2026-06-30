import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Processor for the ANALYTICS_FUNNEL queue.
 *
 * Processes and stores messaging funnel tracking events.
 */
@Processor(QUEUE_NAMES.ANALYTICS_FUNNEL)
export class AnalyticsFunnelPlaceholderProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsFunnelPlaceholderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === JOB_NAMES.FUNNEL_RECORD) {
      const { stage, payload } = job.data;
      
      try {
        await this.prisma.notificationEvent.create({
          data: {
            notificationId: payload.notificationId,
            userId: payload.userId,
            spaceId: payload.spaceId,
            channel: payload.channel,
            eventType: payload.eventType,
            stage,
            metadata: payload.metadata || {},
          },
        });
        return { status: 'success' };
      } catch (err: any) {
        this.logger.error(`Failed to store funnel event for job ${job.id}: ${err.message}`);
        throw err; // BullMQ will handle retries based on config
      }
    }

    // Acknowledge unknown jobs
    return { status: 'acknowledged', queue: 'analytics-funnel', jobId: job.id };
  }
}
