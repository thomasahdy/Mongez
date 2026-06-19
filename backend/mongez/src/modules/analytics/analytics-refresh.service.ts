import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Hourly refresh of all analytics materialized views.
 * Uses CONCURRENTLY where supported to avoid locking readers.
 */
@Injectable()
export class AnalyticsRefreshService {
  private readonly logger = new Logger(AnalyticsRefreshService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshViews() {
    this.logger.log('Refreshing analytics materialized views...');
    const views = [
      'mv_task_completion_by_dept',
      'mv_overdue_by_assignee',
      'mv_approval_sla',
      'mv_ai_usage',
    ];

    for (const view of views) {
      try {
        await this.prisma.$executeRawUnsafe(
          `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`,
        );
      } catch (err) {
        // Fallback: non-concurrent refresh (requires unique index which may be missing on first run)
        try {
          await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${view}`);
          this.logger.warn(
            `Refreshed ${view} without CONCURRENTLY (consider adding a unique index).`,
          );
        } catch (fallbackErr) {
          this.logger.error(
            `Failed to refresh ${view}`,
            (fallbackErr as Error).stack,
          );
        }
      }
    }

    this.logger.log('Analytics materialized views refreshed.');
  }
}