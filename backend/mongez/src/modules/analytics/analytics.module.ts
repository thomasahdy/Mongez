import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRefreshService } from './analytics-refresh.service';
import { AnalyticsFunnelPlaceholderProcessor } from './processors/analytics-funnel-placeholder.processor';
import { MessagingModule } from '../messaging/messaging.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    MessagingModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.ANALYTICS_FUNNEL }),
  ],
  providers: [AnalyticsService, AnalyticsRefreshService, AnalyticsFunnelPlaceholderProcessor],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}