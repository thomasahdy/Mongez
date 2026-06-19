import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskAccessGuard } from './guards/task-access.guard';
import { BoardAccessGuard } from '../boards/guards/board-access.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { PaginationDto, paginate } from '../../shared/dto/pagination.dto';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('tasks')
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @RequirePermissions(['create', 'task'])
  @ApiOperation({ summary: 'Create a task' })
  async create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(dto, req.user.userId, dto.spaceId, dto.spacePrefix);
  }

  @Get('boards/:boardId/tasks')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'List tasks with filters' })
  async getByBoard(@Param('boardId') boardId: string, @Query() filters: FilterTasksDto) {
    const { data, total } = await this.tasksService.getBoardTasks(boardId, filters);
    return paginate(data, total, filters.page, filters.limit);
  }

  @Get('tasks/search')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Full-text search across space' })
  async search(@Query('q') query: string, @Query('spaceId') spaceId: string, @Query() pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const { data, total } = await this.tasksService.search(query, spaceId, skip, pagination.limit);
    return paginate(data, total, pagination.page, pagination.limit);
  }

  @Get('tasks/:id')
  @UseGuards(TaskAccessGuard, PermissionsGuard)
  @RequirePermissions(['read', 'task'])
  @ApiOperation({ summary: 'Get full task' })
  async getById(@Param('id') id: string) {
    return this.tasksService.getTaskById(id);
  }

  @Patch('tasks/:id')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Update task' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.updateTask(id, dto, req.user.userId, req.taskSpaceId);
  }

  @Patch('tasks/:id/move')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Move to different column/position' })
  async move(@Req() req: any, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasksService.moveTask(id, dto, req.user.userId, req.taskSpaceId);
  }

  @Delete('tasks/:id')
  @UseGuards(TaskAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete task' })
  async archive(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.tasksService.softDeleteTask(id, req.user.userId, req.taskSpaceId);
  }

  @Post('tasks/:id/comments')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Add comment' })
  async addComment(@Req() req: any, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.tasksService.addComment(id, dto, req.user.userId, req.taskSpaceId);
  }

  @Get('tasks/:id/comments')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'List comments' })
  async getComments(@Param('id') id: string, @Query() pagination: PaginationDto) {
    const { data, total } = await this.tasksService.getComments(id, pagination.page, pagination.limit);
    return paginate(data, total, pagination.page, pagination.limit);
  }

  @Patch('tasks/:id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Edit own comment' })
  async updateComment(@Req() req: any, @Param('commentId') commentId: string, @Body() dto: UpdateCommentDto) {
    return this.tasksService.updateComment(commentId, dto, req.user.userId);
  }

  @Delete('tasks/:id/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own comment' })
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string): Promise<void> {
    await this.tasksService.deleteComment(commentId, req.user.userId);
  }

  @Post('tasks/:id/time-logs')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Log time' })
  async logTime(@Req() req: any, @Param('id') id: string, @Body() dto: LogTimeDto) {
    return this.tasksService.logTime(id, dto, req.user.userId);
  }

  @Get('tasks/:id/time-logs')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Get time logs' })
  async getTimeLogs(@Param('id') id: string) {
    return this.tasksService.getTimeLogs(id);
  }
}