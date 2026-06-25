import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WorkspaceExportProcessor } from './processors/workspace-export.processor';
import { ReportsPlaceholderProcessor } from './processors/reports-placeholder.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.WORKSPACE_EXPORT }),
    BullModule.registerQueue({ name: QUEUE_NAMES.REPORTS }),
  ],
  controllers: [AdminController],
  providers: [AdminService, WorkspaceExportProcessor, ReportsPlaceholderProcessor],
  exports: [AdminService],
})
export class AdminModule {}
