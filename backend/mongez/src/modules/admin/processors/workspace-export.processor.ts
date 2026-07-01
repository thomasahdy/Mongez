import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { randomUUID } from 'crypto';

@Processor(QUEUE_NAMES.WORKSPACE_EXPORT)
export class WorkspaceExportProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkspaceExportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly traceContext: TraceContextService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name !== 'workspace-export') return;

    const { spaceId, userId, correlationId } = job.data;
    const activeTraceId = correlationId || randomUUID();

    return this.traceContext.run(activeTraceId, async () => {
      this.logger.log(`Starting workspace export for space ${spaceId} requested by user ${userId}`);
      try {
        // Fetch space details, departments, boards, workflows, and members
        const [space, departments, boards, workflows, members] = await Promise.all([
          this.prisma.space.findUnique({
            where: { id: spaceId },
          }),
          this.prisma.department.findMany({
            where: { spaceId },
          }),
          this.prisma.board.findMany({
            where: { department: { spaceId } },
            include: { columns: true },
          }),
          this.prisma.workflowInstance.findMany({
            where: { spaceId },
          }),
          this.prisma.membership.findMany({
            where: { spaceId },
            include: { user: { select: { id: true, name: true, email: true } } },
          }),
        ]);

        if (!space) {
          this.logger.error(`Space ${spaceId} not found for export.`);
          return;
        }

        // Fetch all tasks for the space
        const tasks = await this.prisma.task.findMany({
          where: { board: { department: { spaceId } } },
        });

        // Assemble export JSON payload
        const exportData = {
          exportedAt: new Date().toISOString(),
          space,
          departments,
          boards,
          tasks,
          workflows,
          members: members.map((m) => ({
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
          })),
        };

        const serialized = JSON.stringify(exportData, null, 2);
        const dataSizeKb = Math.round(Buffer.byteLength(serialized, 'utf8') / 1024);

        this.logger.log(`Workspace export complete for space ${spaceId}. Size: ${dataSizeKb} KB`);

        // Save export JSON to storage
        const key = `exports/${spaceId}-${randomUUID()}.json`;
        await this.storageService.upload(key, Buffer.from(serialized), 'application/json');
        const downloadUrl = await this.storageService.getSignedUrl(key, 86400 * 7); // 7 days expiry

        await this.notifications.queueNotification({
          userId,
          spaceId,
          type: 'SYSTEM',
          channel: 'IN_APP',
          priority: 'NORMAL',
          title: 'Workspace Export Complete',
          body: `Your export file is ready. Total size: ${dataSizeKb} KB. Click to download.`,
          entityType: 'space',
          entityId: spaceId,
          metadata: { sizeKb: dataSizeKb, downloadUrl },
        });

      } catch (err: any) {
        this.logger.error(`Failed to export workspace ${spaceId}: ${err.message}`);
        throw err;
      }
    });
  }
}
