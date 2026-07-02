import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { AIService } from './ai.service';
import { AIGatewayService } from './ai-gateway.service';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { SubscriptionGateGuard } from '../subscriptions/guards/subscription-gate.guard';
import { RequiresFeature } from '../subscriptions/decorators/requires-feature.decorator';
import { AIMemoryProfileService } from './memory/ai-memory-profile.service';
import { UpdateMemoryProfileDto } from './dto/memory-profile.dto';

/**
 * Public AI API surface — all routes require user JWT authentication.
 * Rate limited to prevent abuse (configured via ai.rateLimitPerMinute).
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, AiRateLimitGuard)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly aiGateway: AIGatewayService,
    private readonly memoryProfileService: AIMemoryProfileService,
  ) {}

  /** GET /ai/dashboard?spaceId=xxx — Fetch workspace intelligence dashboard stats */
  @Get('dashboard')
  async getDashboard(@Query('spaceId') spaceId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.getDashboard(spaceId, userId);
  }

  /**
   * GET /ai/context?spaceId=xxx — Lightweight workspace context for the AI assistant sidebar.
   * Returns recent active tasks + board list so the FE can pre-populate context without
   * requiring the user to manually select items.
   */
  @Get('context')
  async getContext(@Query('spaceId') spaceId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.getContext(spaceId, userId);
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  /** POST /ai/chat — Send a message, receive AI response (blocking) */
  @Post('chat')
  @RequiresFeature('AI_CHAT')
  @UseGuards(SubscriptionGateGuard)
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.chat(userId, dto);
  }

  /**
   * POST /ai/chat/stream — SSE token stream.
   * Proxies the SSE stream from the Python AI service.
   * Uses manual response writing because NestJS @Sse() only supports GET.
   */
  @Post('chat/stream')
  @RequiresFeature('AI_CHAT')
  @UseGuards(SubscriptionGateGuard)
  async chatStream(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req as any).user?.userId;

    try {
      const { traceId, stream } = await this.aiService.chatStream(userId, dto);

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      stream.subscribe({
        next: (chunk: string) => {
          res.write(`data: ${chunk}\n\n`);
        },
        error: (err: Error) => {
          res.write(
            `data: ${JSON.stringify({ error: err.message })}\n\n`,
          );
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      // Clean up if client disconnects early
      req.on('close', () => {
        res.end();
      });
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          message: 'AI service unavailable. Please try again later.',
          error: error.message,
        });
      }
    }
  }

  // ─── Risk Analysis ─────────────────────────────────────────────────────────

  /** POST /ai/risk/analyze — Trigger risk analysis for a space/board */
  @Post('risk/analyze')
  @RequiresFeature('AI_RISK_SCAN')
  @UseGuards(SubscriptionGateGuard)
  @HttpCode(HttpStatus.OK)
  async analyzeRisk(@Body() dto: RiskAnalysisDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiGateway.analyzeRisk(userId, dto);
  }

  // ─── Report Generation ─────────────────────────────────────────────────────

  /** POST /ai/report/generate — Generate a project report */
  @Post('report/generate')
  @RequiresFeature('AI_REPORTS')
  @UseGuards(SubscriptionGateGuard)
  @HttpCode(HttpStatus.OK)
  async generateReport(@Body() dto: ReportDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiGateway.generateReport(userId, dto);
  }

  // ─── Human-in-the-Loop Actions ────────────────────────────────────────────

  /** GET /ai/actions/pending?spaceId=xxx — List pending AI proposed actions */
  @Get('actions/pending')
  async getPendingActions(@Query('spaceId') spaceId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.getPendingActions(spaceId, userId);
  }

  /** POST /ai/actions/:id/approve — Approve and execute a proposed action */
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
  async submitFeedback(@Body() dto: FeedbackDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.submitFeedback(dto, userId);
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

  // ─── Memory Profile ────────────────────────────────────────────────────────

  /** GET /ai/memory — Fetch raw memory profile for current user */
  @Get('memory')
  async getMemoryProfile(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.memoryProfileService.getMemoryProfileDirect(userId);
  }

  /** POST /ai/memory — Update user memory profile preferences */
  @Post('memory')
  @HttpCode(HttpStatus.OK)
  async updateMemoryProfile(
    @Body() dto: UpdateMemoryProfileDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    return this.memoryProfileService.updateMemoryProfileDirect(userId, dto);
  }

  // ─── Chat Sessions ─────────────────────────────────────────────────

  /** GET /ai/sessions — List all chat sessions for user */
  @Get('sessions')
  async listSessions(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.listChatSessions(userId);
  }

  /** GET /ai/sessions/:id — Get details of a chat session */
  @Get('sessions/:id')
  async getSession(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.getChatSession(id, userId);
  }

  /** POST /ai/sessions — Create a new chat session */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() body: { id?: string; title: string; context?: any; messages: any[] },
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    return this.aiService.createChatSession(userId, body);
  }

  /** PATCH /ai/sessions/:id — Update a chat session's messages/context/title */
  @Patch('sessions/:id')
  async updateSession(
    @Param('id') id: string,
    @Body() body: { title?: string; context?: any; messages?: any[] },
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    return this.aiService.updateChatSession(id, userId, body);
  }

  /** DELETE /ai/sessions/:id — Delete a chat session */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    await this.aiService.deleteChatSession(id, userId);
  }
}
