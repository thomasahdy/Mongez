import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';

/**
 * Placeholder processor for the REPORTS queue.
 *
 * This processor prevents Redis memory buildup by consuming jobs from the 'reports' queue
 * even when report generation is not fully implemented. Report jobs are logged and acknowledged.
 *
 * TODO: Replace this with a real report processor once report templates are configured.
 */
@Processor(QUEUE_NAMES.REPORTS)
export class ReportsPlaceholderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsPlaceholderProcessor.name);

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `[ReportsPlaceholder] Processing job ${job.id} (${job.name}). ` +
      `Report generation not yet implemented - job acknowledged.`
    );

    // Log job data for debugging
    if (job.data) {
      const sanitizedData = {
        ...job.data,
        // Sanitize potential sensitive fields
        userId: job.data.userId ? '[REDACTED]' : undefined,
        spaceId: job.data.spaceId ? '[REDACTED]' : undefined,
      };
      this.logger.debug(`[ReportsPlaceholder] Job data: ${JSON.stringify(sanitizedData)}`);
    }

    // Acknowledge the job to prevent Redis buildup
    return { status: 'acknowledged', queue: 'reports', jobId: job.id };
  }
}
