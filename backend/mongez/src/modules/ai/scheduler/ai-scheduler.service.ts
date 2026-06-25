import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';

@Injectable()
export class AISchedulerService {
  private readonly logger = new Logger(AISchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private readonly aiQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationQueue: Queue,
  ) {}

  // Hourly: scan all active spaces for risk
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleRiskScans() {
    this.logger.log('Starting scheduled hourly risk scans for all spaces...');
    try {
      const spaces = await this.prisma.space.findMany({
        select: { id: true },
      });

      for (const space of spaces) {
        await this.aiQueue.add(
          JOB_NAMES.AI_RISK_SCAN,
          { spaceId: space.id },
          {
            delay: Math.random() * 60000, // Stagger by up to 60s to avoid thundering herd
            jobId: `risk-scan:${space.id}:${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
      }
      this.logger.log(`Enqueued risk scan jobs for ${spaces.length} spaces.`);
    } catch (err: any) {
      this.logger.error(`Failed to schedule risk scans: ${err.message}`);
    }
  }

  // Daily at 8:00 AM — send deadline reminders for tasks due tomorrow
  @Cron('0 8 * * *')
  async scheduleDeadlineReminders() {
    this.logger.log('Running daily task deadline reminders check...');
    try {
      const now = new Date();
      const tomorrow = new Date(Date.now() + 86400000);

      // Find tasks due within the next 24 hours that are not completed or cancelled
      const tasks = await this.prisma.task.findMany({
        where: {
          dueDate: {
            gte: now,
            lte: tomorrow,
          },
          status: {
            notIn: ['DONE', 'CANCELLED'],
          },
          isArchived: false,
        },
        include: {
          assignments: true,
          board: {
            include: {
              department: true,
            },
          },
        },
      });

      let remindersCount = 0;
      for (const task of tasks) {
        const spaceId = task.board?.department?.spaceId;
        if (!spaceId) continue;

        for (const assignment of task.assignments) {
          await this.notificationQueue.add(
            JOB_NAMES.SEND_NOTIFICATION,
            {
              userId: assignment.userId,
              spaceId,
              type: 'DEADLINE_REMINDER',
              channel: 'IN_APP',
              title: `Due soon: ${task.title}`,
              body: `This task is due on ${task.dueDate?.toLocaleDateString()}`,
              entityType: 'task',
              entityId: task.id,
            },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 5000 },
            }
          );
          remindersCount++;
        }
      }
      this.logger.log(`Enqueued ${remindersCount} deadline reminders.`);
    } catch (err: any) {
      this.logger.error(`Failed to run deadline reminders: ${err.message}`);
    }
  }
}
