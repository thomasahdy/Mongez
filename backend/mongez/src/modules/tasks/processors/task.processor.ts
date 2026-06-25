import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { RealtimeService } from '../../realtime/realtime.service';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { FileRepository } from '../../files/file.repository';
import { AIRagService } from '../../ai/services/ai-rag.service';
import { AIRiskService } from '../../ai/services/ai-risk.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EmbeddingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../../notifications/notifications.service';

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class TaskProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
    private readonly realtimeService: RealtimeService,
    private readonly traceContext: TraceContextService,
    private readonly fileRepo: FileRepository,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => AIRagService)) private readonly aiRagService: AIRagService,
    @Inject(forwardRef(() => AIRiskService)) private readonly aiRiskService: AIRiskService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    const correlationId = job.data?.correlationId || randomUUID();

    return this.traceContext.run(correlationId, async () => {
      this.logger.log(`Processing AI job: id=${job.id}, name=${job.name}`);
      if (job.name === JOB_NAMES.ANALYZE_TASK) {
        await this.handleAnalyzeTask(job);
      } else if (job.name === JOB_NAMES.AI_INDEX_DOCUMENT) {
        await this.handleIndexDocument(job);
      } else if (job.name === JOB_NAMES.AI_RISK_SCAN) {
        await this.handleRiskScan(job);
      }
    });
  }

  async handleAnalyzeTask(job: Job<{ taskId: string; spaceId: string; correlationId?: string }>) {
    await this.aiQueue.add(
      JOB_NAMES.AI_INDEX_DOCUMENT,
      {
        spaceId: job.data.spaceId,
        taskId: job.data.taskId,
        correlationId: job.data.correlationId,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );
  }

  async handleIndexDocument(job: Job<{
    spaceId: string;
    taskId: string;
    attachmentId?: string;
    correlationId?: string;
  }>) {
    const { spaceId, taskId, attachmentId } = job.data;
    let versionId: string | null = null;

    this.realtimeService.emitToSpace(spaceId, 'ai:started', {
      jobId: job.id,
      type: 'INDEX_DOCUMENT',
      taskId,
      attachmentId,
    });

    if (attachmentId) {
      const attachment = await this.fileRepo.findById(attachmentId);
      if (attachment && attachment.currentVersionId) {
        versionId = attachment.currentVersionId;
        await this.fileRepo.updateEmbeddingStatus(versionId, EmbeddingStatus.PROCESSING);
      }
    }

    try {
      this.realtimeService.emitToSpace(spaceId, 'ai:progress', {
        jobId: job.id,
        type: 'INDEX_DOCUMENT',
        taskId,
        attachmentId,
        progress: 50,
        status: 'Indexing document content via RAG service',
      });

      this.logger.log(`Indexing document for space=${spaceId}, task=${taskId}, attachment=${attachmentId}`);
      await this.aiRagService.indexDocument(spaceId, taskId);

      if (versionId) {
        await this.fileRepo.updateEmbeddingStatus(versionId, EmbeddingStatus.COMPLETED);
      }

      this.realtimeService.emitToSpace(spaceId, 'ai:completed', {
        jobId: job.id,
        type: 'INDEX_DOCUMENT',
        taskId,
        attachmentId,
      });
    } catch (err: any) {
      this.logger.error(`Document indexing failed: ${err.message}`);

      const attemptsLimit = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attemptsLimit;

      if (isFinalAttempt) {
        if (versionId) {
          await this.fileRepo.updateEmbeddingStatus(versionId, EmbeddingStatus.FAILED);
        }

        try {
          const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            select: { title: true, createdById: true },
          });

          let targetUserId: string | null = null;
          let docName = 'document';

          if (attachmentId) {
            const attachment = await this.fileRepo.findById(attachmentId);
            if (attachment) {
              targetUserId = attachment.uploadedById;
              docName = attachment.fileName;
            }
          }

          if (!targetUserId && task) {
            targetUserId = task.createdById;
          }

          if (targetUserId) {
            await this.notificationsService.createAndNotify({
              userId: targetUserId,
              spaceId,
              type: 'SYSTEM_ALERT',
              channel: 'IN_APP',
              priority: 'HIGH',
              title: 'Document Indexing Failed',
              body: attachmentId
                ? `Failed to index document "${docName}" for task "${task?.title || 'Unknown Task'}". The AI won't be able to search its contents.`
                : `Failed to index task "${task?.title || 'Unknown Task'}" for semantic retrieval.`,
              entityType: 'Task',
              entityId: taskId,
            });
          }
        } catch (notifErr: any) {
          this.logger.error(`Failed to send indexing failure notification: ${notifErr.message}`);
        }
      }

      this.realtimeService.emitToSpace(spaceId, 'ai:failed', {
        jobId: job.id,
        type: 'INDEX_DOCUMENT',
        taskId,
        attachmentId,
        error: err.message,
      });

      throw err; // Rethrow to let BullMQ handle retries
    }
  }

  async handleRiskScan(job: Job<{ spaceId: string; correlationId?: string }>) {
    const { spaceId } = job.data;
    this.logger.log(`Running scheduled risk scan for space=${spaceId}`);

    this.realtimeService.emitToSpace(spaceId, 'ai:started', {
      jobId: job.id,
      type: 'RISK_SCAN',
    });

    // Resolve first active space member to run the scan context
    const firstMember = await this.prisma.membership.findFirst({
      where: { spaceId },
      orderBy: { role: { name: 'asc' } },
      select: { userId: true },
    });

    if (!firstMember) {
      this.logger.warn(`No members found in space ${spaceId}. Skipping risk scan.`);
      this.realtimeService.emitToSpace(spaceId, 'ai:failed', {
        jobId: job.id,
        type: 'RISK_SCAN',
        error: 'No members found in space to run analysis context',
      });
      return;
    }

    try {
      this.realtimeService.emitToSpace(spaceId, 'ai:progress', {
        jobId: job.id,
        type: 'RISK_SCAN',
        progress: 50,
        status: 'Analyzing risk vectors for the space',
      });

      await this.aiRiskService.analyzeRisk(firstMember.userId, {
        spaceId,
      });
      this.logger.log(`Scheduled risk scan completed for space=${spaceId}`);

      this.realtimeService.emitToSpace(spaceId, 'ai:completed', {
        jobId: job.id,
        type: 'RISK_SCAN',
      });
    } catch (err: any) {
      this.logger.error(`Scheduled risk scan failed for space ${spaceId}: ${err.message}`);

      this.realtimeService.emitToSpace(spaceId, 'ai:failed', {
        jobId: job.id,
        type: 'RISK_SCAN',
        error: err.message,
      });

      throw err;
    }
  }
}
