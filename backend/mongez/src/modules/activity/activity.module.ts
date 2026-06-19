import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityEventHandler } from './events/activity.event-handler';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [
    CqrsModule,
    BoardsModule,
  ],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    ActivityEventHandler,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
