import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { AIClientService } from './ai-client.service';

/**
 * Public AI API surface — all routes require user JWT authentication.
 * Rate limited to prevent abuse (configured via ai.rateLimitPerMinute).
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, AiRateLimitGuard)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly aiClient: AIClientService,
  ) {}

  // ─── Chat ──────────────────────────────────────────────────────────────────

  /** POST /ai/chat — Send a message, receive AI response (blocking) */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.chat(userId, dto);
  }

  /**
   * GET /ai/chat/stream — SSE token stream.
   * Phase 2 will proxy the stream from the Python FastAPI /chat/stream endpoint.
   * Phase 1 returns a 501.
   */
  @Get('chat/stream')
  async chatStream(
    @Query() dto: ChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Phase 2: Proxy SSE from Python service
    res.status(HttpStatus.NOT_IMPLEMENTED).json({
      message: 'SSE streaming will be active in Phase 2',
    });
  }

  // ─── Risk Analysis ─────────────────────────────────────────────────────────

  /** POST /ai/risk/analyze — Trigger risk analysis for a space/board */
  @Post('risk/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeRisk(@Body() dto: RiskAnalysisDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.analyzeRisk(userId, dto);
  }

  // ─── Report Generation ─────────────────────────────────────────────────────

  /** POST /ai/report/generate — Generate a project report */
  @Post('report/generate')
  @HttpCode(HttpStatus.OK)
  async generateReport(@Body() dto: ReportDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.generateReport(userId, dto);
  }

  // ─── Human-in-the-Loop Actions ────────────────────────────────────────────

  /** GET /ai/actions/pending?spaceId=xxx — List pending AI proposed actions */
  @Get('actions/pending')
  async getPendingActions(@Query('spaceId') spaceId: string) {
    return this.aiService.getPendingActions(spaceId);
  }

  /** POST /ai/actions/:id/approve — Approve a proposed action */
  @Post('actions/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveAction(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @Req() req: Request,
  ) {
    const reviewerId = (req as any).user?.userId;
    return this.aiService.approveAction(id, reviewerId, dto);
  }

  /** POST /ai/actions/:id/reject — Reject a proposed action */
  @Post('actions/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectAction(
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
    @Req() req: Request,
  ) {
    const reviewerId = (req as any).user?.userId;
    return this.aiService.rejectAction(id, reviewerId, dto);
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────

  /** POST /ai/feedback — Submit thumbs up/down + optional note */
  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(@Body() dto: FeedbackDto) {
    return this.aiService.submitFeedback(dto);
  }

  // ─── History ──────────────────────────────────────────────────────────────

  /** GET /ai/requests — AI request history (paginated) */
  @Get('requests')
  async getHistory(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const userId = (req as any).user?.userId;
    return this.aiService.getHistory(userId, parseInt(page, 10), parseInt(limit, 10));
  }
}
