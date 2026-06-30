import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { AuditService } from '../audit.service';
import { AuditLogInput } from '../dto/audit-log-input.dto';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { randomUUID } from 'crypto';

@Processor(QUEUE_NAMES.ACTIVITY_LOG)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly traceContext: TraceContextService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const correlationId = job.data?.correlationId || randomUUID();

    return this.traceContext.run(correlationId, async () => {
      try {
        if (job.name === JOB_NAMES.LOG_ACTIVITY) {
          await this.auditService.record(job.data as AuditLogInput);
        } else if (job.name === JOB_NAMES.LOG_USER_ACTIVITY) {
          await this.auditService.recordUserActivity(job.data);
        }
      } catch (err: any) {
        this.logger.error(`Audit/Activity log job ${job.id} failed: ${err.message}`);
        throw err;
      }
    });
  }
}