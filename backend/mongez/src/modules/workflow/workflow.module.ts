import { Module, forwardRef } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CqrsModule } from '@nestjs/cqrs';
import { DelegationModule } from '../delegation/delegation.module';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    RealtimeModule,
    forwardRef(() => MessagingModule),
    CqrsModule,
    DelegationModule,
    SlaModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRepository, WorkflowSchedulerService],
  exports: [WorkflowService],
})
export class WorkflowModule { }