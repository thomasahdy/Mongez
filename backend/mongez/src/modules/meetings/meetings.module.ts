import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    HttpModule,
    StorageModule,
    TasksModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
