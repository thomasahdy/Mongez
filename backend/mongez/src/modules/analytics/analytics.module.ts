import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRefreshService } from './analytics-refresh.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  providers: [AnalyticsService, AnalyticsRefreshService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}