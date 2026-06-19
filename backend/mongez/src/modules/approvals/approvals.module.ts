import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ApprovalRepository } from './repositories/approval.repository';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalRepository],
  exports: [ApprovalsService, ApprovalRepository],
})
export class ApprovalsModule {}
