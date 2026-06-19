import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileRepository } from './file.repository';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { VirusScannerService } from '../../infrastructure/scanners/virus-scanner.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';

@Module({
  imports: [
    StorageModule,
    RealtimeModule,
    QueueModule,
    SubscriptionsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_PROCESSING }),
  ],
  controllers: [FilesController],
  providers: [FilesService, FileRepository, VirusScannerService],
  exports: [FilesService],
})
export class FilesModule {}