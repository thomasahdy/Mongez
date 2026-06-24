import {
  Controller,
  Post,
  Get,
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
  ) {}

  /** GET /ai/dashboard?spaceId=xxx — Fetch workspace intelligence dashboard stats */
  @Get('dashboard')
  async getDashboard(@Query('spaceId') spaceId: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiService.getDashboard(spaceId, userId);
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  /** POST /ai/chat — Send a message, receive AI response (blocking) */
  @Post('chat')
  @RequiresFeature('AI_CHAT')
  @UseGuards(SubscriptionGateGuard)
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.aiGateway.chat(userId, dto);
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
      const { traceId, stream } = await this.aiGateway.streamChat(userId, dto);

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
}
