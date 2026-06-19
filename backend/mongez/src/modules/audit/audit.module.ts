import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditProcessor } from './processors/audit.processor';
import { AuditEventHandler } from './events/audit.event-handler';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.ACTIVITY_LOG }),
    CqrsModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditProcessor, AuditEventHandler],
  exports: [AuditService],
})
export class AuditModule {}