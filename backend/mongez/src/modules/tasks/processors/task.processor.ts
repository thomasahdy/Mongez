import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { randomUUID } from 'crypto';

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class TaskProcessor extends WorkerHost {
  constructor(
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
    private readonly realtimeService: RealtimeService,
    private readonly traceContext: TraceContextService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    const correlationId = job.data?.correlationId || randomUUID();

    return this.traceContext.run(correlationId, async () => {
      if (job.name === JOB_NAMES.ANALYZE_TASK) {
        await this.handleAnalyzeTask(job);
      }
    });
  }

  async handleAnalyzeTask(job: Job<{ taskId: string; spaceId: string; correlationId?: string }>) {
    await this.aiQueue.add(JOB_NAMES.AI_INDEX_DOCUMENT, {
      spaceId: job.data.spaceId,
      taskId: job.data.taskId,
      correlationId: job.data.correlationId,
    });
  }
}
