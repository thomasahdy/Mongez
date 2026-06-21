import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationProcessor } from './processors/notification.processor';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { RealtimeModule } from '../realtime/realtime.module';
import { OutboxRepository } from './outbox/outbox.repository';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { EmailChannel } from './channels/email.channel';
import { WebSocketChannel } from './channels/websocket.channel';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PresenceService } from './presence/presence.service';
import { ApprovalExpiryProcessor } from '../messaging/approvals/approval-expiry.service';

import { CacheModule } from '../../infrastructure/cache/cache.module';
import { forwardRef } from '@nestjs/common';
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
    BullModule.registerQueue({ name: QUEUE_NAMES.APPROVAL_EXPIRY }),
    RealtimeModule,
    forwardRef(() => WhatsAppModule),
    forwardRef(() => TelegramModule),
    MessagingModule,
    CacheModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRepository,
    NotificationProcessor,
    OutboxRepository,
    OutboxRelayService,
    EmailChannel,
    WebSocketChannel,
    PresenceService,
    ApprovalExpiryProcessor,
  ],
  exports: [NotificationsService, OutboxRepository, PresenceService],
})
export class NotificationsModule { }