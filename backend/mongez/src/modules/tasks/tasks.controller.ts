import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':id')
  async getTask(@Param('id') id: string) {
    return this.tasksService.getTaskById(id);
  }

  @Get('board/:boardId')
  async getBoardTasks(
    @Param('boardId') boardId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('priority') priority?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.tasksService.getBoardTasks(
      boardId,
      { status, assigneeId, priority },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post()
  async createTask(@Body() body: any) {
    return this.tasksService.createTask(body);
  }

  @Patch(':id')
  async updateTask(@Param('id') id: string, @Body() body: any) {
    return this.tasksService.updateTask(id, body);
  }

  @Delete(':id')
  async deleteTask(@Param('id') id: string) {
    return this.tasksService.deleteTask(id);
  }
}