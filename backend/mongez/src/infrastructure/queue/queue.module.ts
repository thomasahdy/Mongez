import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsQueueEventsListener, AIProcessingQueueEventsListener } from './dlq.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: false, // Keep failed jobs visible for DLQ processing
        },
      }),
    }),
  ],
  providers: [NotificationsQueueEventsListener, AIProcessingQueueEventsListener],
  exports: [BullModule, NotificationsQueueEventsListener, AIProcessingQueueEventsListener],
})
export class QueueModule {}