import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRepository, CommentRepository, TimeLogRepository } from './repositories/tasks.repositories';
import { TaskProcessor } from './processors/task.processor';
import { TaskAccessGuard } from './guards/task-access.guard';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { BoardsModule } from '../boards/boards.module';
import { SpacesModule } from '../spaces/spaces.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_PROCESSING }),
    BoardsModule,
    SpacesModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskRepository,
    CommentRepository,
    TimeLogRepository,
    TaskProcessor,
    TaskAccessGuard,
  ],
  exports: [TasksService],
})
export class TasksModule {}