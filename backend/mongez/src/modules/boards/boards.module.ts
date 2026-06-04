import { Module } from '@nestjs/common';
import { BoardsController, DepartmentBoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import { BoardAccessGuard } from './guards/board-access.guard';

@Module({
  controllers: [BoardsController, DepartmentBoardsController],
  providers: [BoardsService, BoardRepository, ColumnRepository, BoardAccessGuard],
  exports: [BoardsService, BoardAccessGuard],
})
export class BoardsModule {}