import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './notification.repository';
import { NotificationProcessor } from './notification.processor';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRepository, NotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}