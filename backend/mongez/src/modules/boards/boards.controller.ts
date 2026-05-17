import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardsService } from './boards.service';
import { BoardAccessGuard } from './guards/board-access.guard';
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateColumnDto,
  UpdateColumnDto,
  ReorderColumnsDto,
} from './dto/boards.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Boards')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Create a board (auto-creates 4 default columns)' })
  async create(@Body() dto: CreateBoardDto) {
    return this.boardsService.create(dto);
  }

  @Get(':id')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Get board with columns and task count' })
  async getById(@Param('id') id: string) {
    return this.boardsService.getById(id);
  }

  @Patch(':id')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Update board name or type' })
  async update(@Param('id') id: string, @Body() dto: UpdateBoardDto) {
    return this.boardsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(BoardAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a board' })
  async archive(@Param('id') id: string): Promise<void> {
    await this.boardsService.archive(id);
  }

  @Post(':id/columns')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Add a new column to the board' })
  async addColumn(@Param('id') boardId: string, @Body() dto: CreateColumnDto) {
    return this.boardsService.addColumn(boardId, dto);
  }

  @Patch(':id/columns/reorder')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Reorder columns (drag-and-drop) — send full new order array' })
  async reorderColumns(@Param('id') boardId: string, @Body() dto: ReorderColumnsDto) {
    return this.boardsService.reorderColumns(boardId, dto);
  }

  @Patch(':id/columns/:colId')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Update a column (name, color, wipLimit)' })
  async updateColumn(
    @Param('id') boardId: string,
    @Param('colId') colId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.boardsService.updateColumn(boardId, colId, dto);
  }

  @Delete(':id/columns/:colId')
  @UseGuards(BoardAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a column (fails if it has active tasks)' })
  async deleteColumn(@Param('id') boardId: string, @Param('colId') colId: string): Promise<void> {
    await this.boardsService.deleteColumn(boardId, colId);
  }
}

// ─── Department → Boards listing ─────────────────────────────

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentBoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get(':deptId/boards')
  @ApiOperation({ summary: 'List boards in a department (paginated)' })
  async getByDepartment(@Param('deptId') deptId: string, @Query() pagination: PaginationDto) {
    return this.boardsService.getByDepartment(deptId, pagination.page, pagination.limit);
  }
}