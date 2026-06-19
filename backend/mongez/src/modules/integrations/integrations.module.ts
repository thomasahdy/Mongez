import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationRepository } from './repositories/integration.repository';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationRepository],
  exports: [IntegrationsService, IntegrationRepository],
})
export class IntegrationsModule {}
