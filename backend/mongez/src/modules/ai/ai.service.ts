import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AIClientService } from './ai-client.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';

/**
 * Orchestrates all AI interactions.
 *
 * Phase 1 behaviour:
 *  - All methods create an AIRequest row (for observability from day 1)
 *  - Methods that call the Python AI service throw NotImplementedException
 *    (the Python service doesn't exist yet — implemented in Phase 2)
 *  - Approval/feedback methods are fully functional (pure DB operations)
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly aiClient: AIClientService,
    private readonly requestRepo: AIRequestRepository,
    private readonly actionRepo: AIActionRepository,
  ) {}

  // ─── Chat ──────────────────────────────────────────────────────────────────

  async chat(userId: string, dto: ChatDto) {
    const traceId = randomUUID();
    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'chat',
      rawInput: dto.message,
    });
    this.logger.log(`[${traceId}] chat intent created — Phase 2 will implement AI call`);
    throw new NotImplementedException('Chat AI endpoint will be active in Phase 2');
  }

  // ─── Risk Analysis ─────────────────────────────────────────────────────────

  async analyzeRisk(userId: string, dto: RiskAnalysisDto) {
    const traceId = randomUUID();
    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'risk',
      rawInput: `boardId=${dto.boardId ?? 'all'} taskId=${dto.taskId ?? 'all'}`,
    });
    this.logger.log(`[${traceId}] risk intent created — Phase 2 will implement AI call`);
    throw new NotImplementedException('Risk analysis endpoint will be active in Phase 2');
  }

  // ─── Report Generation ─────────────────────────────────────────────────────

  async generateReport(userId: string, dto: ReportDto) {
    const traceId = randomUUID();
    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'report',
      rawInput: `reportType=${dto.reportType ?? 'weekly'} boardId=${dto.boardId ?? 'all'}`,
    });
    this.logger.log(`[${traceId}] report intent created — Phase 2 will implement AI call`);
    throw new NotImplementedException('Report generation endpoint will be active in Phase 2');
  }

  // ─── Proposed Actions (Human-in-the-Loop) ─────────────────────────────────

  async getPendingActions(spaceId: string) {
    return this.actionRepo.findPending(spaceId);
  }

  async approveAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    const action = await this.actionRepo.findById(actionId);
    if (!action) throw new NotFoundException(`AI proposed action ${actionId} not found`);
    return this.actionRepo.approve(actionId, reviewerId, dto.reviewNote);
  }

  async rejectAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    const action = await this.actionRepo.findById(actionId);
    if (!action) throw new NotFoundException(`AI proposed action ${actionId} not found`);
    return this.actionRepo.reject(actionId, reviewerId, dto.reviewNote);
  }

  // ─── Feedback ──────────────────────────────────────────────────────────────

  async submitFeedback(dto: FeedbackDto) {
    const existing = await this.requestRepo.findByTraceId(dto.traceId);
    if (!existing) throw new NotFoundException(`AI request with traceId ${dto.traceId} not found`);
    return this.requestRepo.update(dto.traceId, {
      userFeedback: dto.rating,
      feedbackNote: dto.note,
    });
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async getHistory(userId: string, page = 1, limit = 20) {
    return this.requestRepo.findByUser(userId, page, limit);
  }
}
