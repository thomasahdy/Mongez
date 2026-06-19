import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WorkspaceExportProcessor } from './processors/workspace-export.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.WORKSPACE_EXPORT }),
  ],
  controllers: [AdminController],
  providers: [AdminService, WorkspaceExportProcessor],
  exports: [AdminService],
})
export class AdminModule {}
