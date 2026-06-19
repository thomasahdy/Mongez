import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { forwardRef } from '@nestjs/common';
@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    RealtimeModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRepository, WorkflowSchedulerService],
  exports: [WorkflowService],
})
export class WorkflowModule { }