import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { SpacesModule } from '../spaces/spaces.module';
import { MessagingModule } from '../messaging/messaging.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppRepository } from './repositories/whatsapp.repository';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { WhatsAppProcessor } from './processors/whatsapp.processor';

@Module({
  imports: [
    SpacesModule,
    forwardRef(() => MessagingModule),
    BullModule.registerQueue({ name: QUEUE_NAMES.WHATSAPP }),
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppRepository,
    WhatsAppChannel,
    WhatsAppProcessor,
  ],
  exports: [WhatsAppService, WhatsAppChannel, WhatsAppRepository],
})
export class WhatsAppModule {}
