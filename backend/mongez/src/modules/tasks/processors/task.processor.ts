import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { RealtimeService } from '../../realtime/realtime.service';

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class TaskProcessor extends WorkerHost {
  constructor(
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
    private readonly realtimeService: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === JOB_NAMES.ANALYZE_TASK) {
      await this.handleAnalyzeTask(job);
    }
  }

  async handleAnalyzeTask(job: Job<{ taskId: string; spaceId: string }>) {
    await this.aiQueue.add(JOB_NAMES.AI_INDEX_DOCUMENT, {
      spaceId: job.data.spaceId,
      taskId: job.data.taskId,
    });
  }
}
