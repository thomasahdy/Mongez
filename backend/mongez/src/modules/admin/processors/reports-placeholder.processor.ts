import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';

/**
 * Processor for the REPORTS queue.
 * Handles background generation of CSV/PDF exports.
 */
@Processor(QUEUE_NAMES.REPORTS)
export class ReportsPlaceholderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsPlaceholderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`[ReportsProcessor] Processing job ${job.id} (${job.name})`);

    if (job.name === JOB_NAMES.GENERATE_REPORT) {
      const { spaceId, userId, format, type } = job.data;
      if (format === 'csv' && type === 'task_export') {
        const tasks = await this.prisma.task.findMany({
          where: { board: { department: { spaceId } } },
          select: {
            identifier: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });

        // Simulate CSV Generation
        const csvRows = ['ID,Title,Status,Priority,CreatedAt,DueDate'];
        tasks.forEach(t => {
          csvRows.push(`${t.identifier},"${t.title.replace(/"/g, '""')}",${t.status},${t.priority},${t.createdAt.toISOString()},${t.dueDate ? t.dueDate.toISOString() : ''}`);
        });
        const csvString = csvRows.join('\n');

        // Simulate saving to a file storage (e.g., S3) and returning URL
        const mockUrl = `https://export.mongez.app/reports/${job.id}.csv`;

        // Notify user via WebSocket
        this.realtime.emitToUser(userId, 'export:ready', {
          url: mockUrl,
          message: 'Your CSV export is ready to download.',
        });

        return { status: 'success', url: mockUrl };
      }
    }

    // Acknowledge unknown jobs
    return { status: 'acknowledged', queue: 'reports', jobId: job.id };
  }
}
