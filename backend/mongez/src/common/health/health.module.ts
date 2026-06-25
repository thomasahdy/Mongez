import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HttpModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.EMAILS },
      { name: QUEUE_NAMES.AI_PROCESSING },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.ACTIVITY_LOG },
      { name: QUEUE_NAMES.WORKSPACE_EXPORT },
      { name: QUEUE_NAMES.WHATSAPP },
      { name: QUEUE_NAMES.TELEGRAM },
      { name: QUEUE_NAMES.APPROVAL_EXPIRY },
      { name: QUEUE_NAMES.ANALYTICS_FUNNEL },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule { }
