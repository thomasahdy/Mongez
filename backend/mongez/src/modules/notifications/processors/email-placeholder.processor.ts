import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';

/**
 * Placeholder processor for the EMAILS queue.
 *
 * This processor prevents Redis memory buildup by consuming jobs from the 'emails' queue
 * even when email sending is not fully implemented. Email jobs are logged and acknowledged.
 *
 * TODO: Replace this with a real email processor once email templates and provider are configured.
 */
@Processor(QUEUE_NAMES.EMAILS)
export class EmailPlaceholderProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailPlaceholderProcessor.name);

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `[EmailPlaceholder] Processing job ${job.id} (${job.name}). ` +
      `Email sending not yet implemented - job acknowledged.`
    );

    // Log job data for debugging (exclude sensitive data in production)
    if (job.data) {
      const sanitizedData = {
        ...job.data,
        // Sanitize common sensitive fields
        to: job.data.to ? '[REDACTED]' : undefined,
        cc: job.data.cc ? '[REDACTED]' : undefined,
        bcc: job.data.bcc ? '[REDACTED]' : undefined,
      };
      this.logger.debug(`[EmailPlaceholder] Job data: ${JSON.stringify(sanitizedData)}`);
    }

    // Acknowledge the job to prevent Redis buildup
    return { status: 'acknowledged', queue: 'emails', jobId: job.id };
  }
}
