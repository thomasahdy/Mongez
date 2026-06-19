import { Module } from '@nestjs/common';
import { BoardsController, DepartmentBoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import { BoardAccessGuard } from './guards/board-access.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TrashModule } from '../trash/trash.module';

@Module({
  imports: [SubscriptionsModule, TrashModule],
  controllers: [BoardsController, DepartmentBoardsController],
  providers: [BoardsService, BoardRepository, ColumnRepository, BoardAccessGuard],
  exports: [BoardsService, BoardAccessGuard],
})
export class BoardsModule {}