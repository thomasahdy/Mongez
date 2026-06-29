import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { EmailChannel } from '../channels/email.channel';

/**
 * Processor for the EMAILS queue.
 * Handles async email dispatch jobs using the configured SMTP transporter.
 */
@Processor(QUEUE_NAMES.EMAILS)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject(forwardRef(() => EmailChannel))
    private readonly emailChannel: EmailChannel,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`[EmailProcessor] Processing job ${job.id} (${job.name})`);

    if (job.name === JOB_NAMES.SEND_EMAIL) {
      const { userId, title, body, eventId } = job.data;
      if (!userId || !title) {
        this.logger.error(`[EmailProcessor] Job ${job.id} is missing payload data (userId or title)`);
        return { status: 'failed', error: 'Missing payload data' };
      }

      const success = await this.emailChannel.sendMailDirect(userId, title, body || '', eventId || '');
      return { status: success ? 'sent' : 'failed', queue: 'emails', jobId: job.id };
    }

    // fallback log for other or legacy jobs
    this.logger.warn(`[EmailProcessor] Unrecognized job name: ${job.name}. Acknowledging.`);
    return { status: 'acknowledged', queue: 'emails', jobId: job.id };
  }
}
