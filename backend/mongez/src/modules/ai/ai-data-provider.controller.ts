import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';
import { AIDataProviderService } from './ai-data-provider.service';

/**
 * Internal API for the Python AI service.
 * Protected by X-Service-API-Key header — NOT user JWT.
 * These routes are NOT exposed to the frontend.
 */
@Controller('internal/ai')
@UseGuards(ServiceApiKeyGuard)
export class AIDataProviderController {
  constructor(private readonly dataProvider: AIDataProviderService) {}

  /**
   * GET /internal/ai/tasks/:spaceId[?boardId=xxx]
   * Returns tasks with assignees, status, board for the given space.
   * Optional boardId query param filters to a single board.
   */
  @Get('tasks/:spaceId')
  async getTasksBySpace(
    @Param('spaceId') spaceId: string,
    @Query('boardId') boardId?: string,
  ) {
    return this.dataProvider.getTasksBySpace(spaceId, boardId);
  }

  /**
   * GET /internal/ai/comments/:taskId
   * Returns all comments for a single task.
   */
  @Get('comments/:taskId')
  async getCommentsByTask(@Param('taskId') taskId: string) {
    return this.dataProvider.getCommentsByTask(taskId);
  }

  /**
   * GET /internal/ai/comments/space/:spaceId
   * Returns all comments for all tasks in a space.
   * Used by the RAG indexer for bulk ingestion.
   */
  @Get('comments/space/:spaceId')
  async getCommentsBySpace(@Param('spaceId') spaceId: string) {
    return this.dataProvider.getCommentsBySpace(spaceId);
  }

  /**
   * GET /internal/ai/audit-log/:spaceId
   * Returns recent audit log entries for a space.
   */
  @Get('audit-log/:spaceId')
  async getAuditLog(@Param('spaceId') spaceId: string) {
    return this.dataProvider.getAuditLogBySpace(spaceId);
  }

  /**
   * GET /internal/ai/schema
   * Returns the DB schema as JSON for Text-to-SQL prompt construction.
   */
  @Get('schema')
  getSchema() {
    return this.dataProvider.getSchemaDescription();
  }
}
