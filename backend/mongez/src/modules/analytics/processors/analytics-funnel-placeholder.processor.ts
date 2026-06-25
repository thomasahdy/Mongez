import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';

/**
 * Placeholder processor for the ANALYTICS_FUNNEL queue.
 *
 * This processor prevents Redis memory buildup by consuming jobs from the 'analytics-funnel' queue
 * even when analytics funnel tracking is not fully implemented. Funnel jobs are logged and acknowledged.
 *
 * TODO: Replace this with a real analytics funnel processor once funnel events are configured.
 */
@Processor(QUEUE_NAMES.ANALYTICS_FUNNEL)
export class AnalyticsFunnelPlaceholderProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsFunnelPlaceholderProcessor.name);

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `[AnalyticsFunnelPlaceholder] Processing job ${job.id} (${job.name}). ` +
      `Analytics funnel tracking not yet implemented - job acknowledged.`
    );

    // Log job data for debugging
    if (job.data) {
      const sanitizedData = {
        ...job.data,
        // Sanitize potential sensitive fields
        userId: job.data.userId ? '[REDACTED]' : undefined,
        spaceId: job.data.spaceId ? '[REDACTED]' : undefined,
      };
      this.logger.debug(`[AnalyticsFunnelPlaceholder] Job data: ${JSON.stringify(sanitizedData)}`);
    }

    // Acknowledge the job to prevent Redis buildup
    return { status: 'acknowledged', queue: 'analytics-funnel', jobId: job.id };
  }
}
