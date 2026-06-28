import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ServiceApiKeyGuard } from './guards/service-api-key.guard';
import { AIDataProviderService } from './ai-data-provider.service';
import { AIActionRepository } from './repositories/ai-action.repository';
import { CalendarService } from '../calendar/services/calendar.service';
import { WorkspaceGraphService } from './services/workspace-graph.service';

/**
 * Internal API for the Python AI service.
 * Protected by X-Service-API-Key header — NOT user JWT.
 * These routes are NOT exposed to the frontend.
 */
@Controller('internal/ai')
@UseGuards(ServiceApiKeyGuard)
export class AIDataProviderController {
  constructor(
    private readonly dataProvider: AIDataProviderService,
    private readonly actionRepo: AIActionRepository,
    private readonly calendarService: CalendarService,
    private readonly graphService: WorkspaceGraphService,
  ) {}

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
   * GET /internal/ai/tasks/single/:taskId
   * Returns a single task details for indexing/RAG.
   */
  @Get('tasks/single/:taskId')
  async getTaskById(@Param('taskId') taskId: string) {
    return this.dataProvider.getTaskById(taskId);
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

  /**
   * POST /internal/ai/propose-action
   * Receives a proposed action from the AI service and stores it.
   */
  @Post('propose-action')
  async proposeAction(@Body() body: any) {
    const commandType = body.commandType || body.command_type;
    return this.actionRepo.create({
      traceId: body.traceId,
      spaceId: body.spaceId,
      commandType,
      payload: body.payload,
      reason: body.reason,
    });
  }

  /**
   * GET /internal/ai/calendar/:spaceId
   * Returns merged calendar events (custom, Google, approvals, tasks, holidays) for RAG/agent diagnostics.
   */
  @Get('calendar/:spaceId')
  async getCalendar(
    @Param('spaceId') spaceId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const end = endDate || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
    return this.calendarService.getUnifiedFeed(spaceId, start, end, undefined, {
      sources: ['MONGEZ', 'GOOGLE', 'HOLIDAY', 'MEETING', 'APPROVAL', 'ESCALATION'],
    });
  }

  /**
   * GET /internal/ai/graph/dependencies/:spaceId
   */
  @Get('graph/dependencies/:spaceId')
  async getTaskDependencies(@Param('spaceId') spaceId: string) {
    return this.graphService.getTaskDependencies(spaceId);
  }

  /**
   * GET /internal/ai/graph/blockers/:spaceId
   */
  @Get('graph/blockers/:spaceId')
  async getBlockerChain(@Param('spaceId') spaceId: string) {
    return this.graphService.getBlockerChain(spaceId);
  }

  /**
   * GET /internal/ai/graph/workflows/:spaceId
   */
  @Get('graph/workflows/:spaceId')
  async getWorkflowGraph(@Param('spaceId') spaceId: string) {
    return this.graphService.getWorkflowGraph(spaceId);
  }

  /**
   * GET /internal/ai/graph/org/:spaceId
   */
  @Get('graph/org/:spaceId')
  async getOrgGraph(@Param('spaceId') spaceId: string) {
    return this.graphService.getOrgGraph(spaceId);
  }

  /**
   * GET /internal/ai/graph/decisions/:spaceId
   */
  @Get('graph/decisions/:spaceId')
  async getDecisions(@Param('spaceId') spaceId: string) {
    return this.graphService.getDecisions(spaceId);
  }
}

