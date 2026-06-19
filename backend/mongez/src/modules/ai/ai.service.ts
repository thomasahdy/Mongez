import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { Observable } from 'rxjs';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly requestRepo: AIRequestRepository,
    private readonly actionRepo: AIActionRepository,
    private readonly cache: CacheService,
  ) {}

  async chat(userId: string, dto: ChatDto) {
    return this.aiGateway.chat(userId, dto);
  }

  async chatStream(userId: string, dto: ChatDto): Promise<{ traceId: string; stream: Observable<string> }> {
    return this.aiGateway.streamChat(userId, dto);
  }

  async analyzeRisk(userId: string, dto: RiskAnalysisDto) {
    return this.aiGateway.analyzeRisk(userId, dto);
  }

  async generateReport(userId: string, dto: ReportDto) {
    return this.aiGateway.generateReport(userId, dto);
  }

  async getPendingActions(spaceId: string) {
    return this.actionRepo.findPending(spaceId);
  }

  async approveAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    return this.aiGateway.executeApprovedAction(actionId, reviewerId);
  }

  async rejectAction(actionId: string, reviewerId: string, dto: ApprovalActionDto) {
    const action = await this.actionRepo.findById(actionId);
    if (!action) throw new NotFoundException(`AI proposed action ${actionId} not found`);
    return this.actionRepo.reject(actionId, reviewerId, dto.reviewNote);
  }

  async submitFeedback(dto: FeedbackDto) {
    const existing = await this.requestRepo.findByTraceId(dto.traceId);
    if (!existing) throw new NotFoundException(`AI request with traceId ${dto.traceId} not found`);
    return this.requestRepo.update(dto.traceId, {
      userFeedback: dto.rating,
      feedbackNote: dto.note,
    });
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    return this.requestRepo.findByUser(userId, page, limit);
  }

  async invalidateCacheForSpace(spaceId: string) {
    this.logger.log(`Invalidating AI cache for space ${spaceId}`);
    await Promise.all([
      this.cache.delPattern(`ai:chat:${spaceId}:*`),
      this.cache.delPattern(`ai:risk:${spaceId}:*`),
    ]);
  }
}
