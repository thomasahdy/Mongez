import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { SpacesModule } from '../spaces/spaces.module';
import { MessagingModule } from '../messaging/messaging.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './services/telegram.service';
import { TelegramRepository } from './repositories/telegram.repository';
import { TelegramChannel } from './channels/telegram.channel';
import { TelegramProcessor } from './processors/telegram.processor';

@Module({
  imports: [
    SpacesModule,
    forwardRef(() => MessagingModule),
    BullModule.registerQueue({ name: QUEUE_NAMES.TELEGRAM }),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramRepository,
    TelegramChannel,
    TelegramProcessor,
  ],
  exports: [TelegramService, TelegramChannel, TelegramRepository],
})
export class TelegramModule {}
