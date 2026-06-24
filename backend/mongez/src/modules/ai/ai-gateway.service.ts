import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { AILlmService } from './services/ai-llm.service';
import { AIRagService } from './services/ai-rag.service';
import { AIRiskService } from './services/ai-risk.service';
import { AIExecutorService, ExecutionResult } from './services/ai-executor.service';
import { AIMemoryService } from './memory/ai-memory.service';
import { AICircuitBreakerService } from './circuit-breaker/ai-circuit-breaker.service';
import { ChatDto } from './dto/chat.dto';
import { RiskAnalysisDto } from './dto/risk-analysis.dto';
import { ReportDto } from './dto/report.dto';
import { Observable } from 'rxjs';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AIMemoryProfileService } from './memory/ai-memory-profile.service';

@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);

  constructor(
    private readonly llm: AILlmService,
    private readonly rag: AIRagService,
    private readonly risk: AIRiskService,
    private readonly executor: AIExecutorService,
    private readonly memory: AIMemoryService,
    private readonly circuit: AICircuitBreakerService,
    private readonly subscriptions: SubscriptionsService,
    private readonly aiMemoryProfileService: AIMemoryProfileService,
  ) {}

  async chat(userId: string, dto: ChatDto): Promise<any> {
    if (dto.spaceId) {
      const withinLimit = await this.subscriptions.checkQuota(dto.spaceId, 'AI_REQUESTS');
      if (!withinLimit) {
        throw new ForbiddenException('You have exceeded your monthly AI requests quota. Please upgrade.');
      }
    }

    const sanitizedMessage = this.sanitizeForPrompt(dto.message);
    const memoryContext = dto.spaceId
      ? await this.memory.getConversationContext(userId, dto.spaceId)
      : '';
    const profile = await this.aiMemoryProfileService.getMemoryProfile(userId);
    const enrichedMemoryContext = profile
      ? `User Preferences:\n${profile}\n\n${memoryContext}`
      : memoryContext;

    const result = await this.circuit.call(() =>
      this.llm.chat(userId, { ...dto, message: sanitizedMessage, memoryContext: enrichedMemoryContext }),
    );

    if (result && !result.degraded && dto.spaceId) {
      await this.memory.appendToSession(userId, dto.spaceId, { role: 'user', content: sanitizedMessage });
      await this.memory.saveConversationTurn(userId, dto.spaceId, 'user', sanitizedMessage, result.traceId);

      const responseText = result.response || '';
      await this.memory.appendToSession(userId, dto.spaceId, { role: 'assistant', content: responseText });
      await this.memory.saveConversationTurn(userId, dto.spaceId, 'assistant', responseText, result.traceId);

      // Record AI Requests and Tokens usage
      await this.subscriptions.recordUsage(dto.spaceId, 'AI_REQUESTS');
      const tokensIn = result.metadata?.tokens_in ?? 0;
      const tokensOut = result.metadata?.tokens_out ?? 0;
      const totalTokens = tokensIn + tokensOut;
      if (totalTokens > 0) {
        await this.subscriptions.recordUsage(dto.spaceId, 'AI_TOKENS', totalTokens);
      }
    }

    return result;
  }

  async streamChat(userId: string, dto: ChatDto): Promise<{ traceId: string; stream: Observable<string> }> {
    if (dto.spaceId) {
      const withinLimit = await this.subscriptions.checkQuota(dto.spaceId, 'AI_REQUESTS');
      if (!withinLimit) {
        throw new ForbiddenException('You have exceeded your monthly AI requests quota. Please upgrade.');
      }
    }

    const sanitizedMessage = this.sanitizeForPrompt(dto.message);

    const result = (await this.circuit.call(() =>
      this.llm.chatStream(userId, { ...dto, message: sanitizedMessage }),
    )) as any;

    if (result && !result.degraded) {
      if (dto.spaceId) {
        await this.memory.appendToSession(userId, dto.spaceId, { role: 'user', content: sanitizedMessage });
        await this.memory.saveConversationTurn(userId, dto.spaceId, 'user', sanitizedMessage, result.traceId);
      }

      let fullResponse = '';
      let tokensUsed = 0;
      const trackedStream = new Observable<string>((subscriber) => {
        result.stream.subscribe({
          next: (chunk) => {
            try {
              const parsed = JSON.parse(chunk);
              if (parsed.token) {
                fullResponse += parsed.token;
              }
              if (parsed.metadata) {
                tokensUsed = (parsed.metadata.tokens_in ?? 0) + (parsed.metadata.tokens_out ?? 0);
              }
            } catch {}
            subscriber.next(chunk);
          },
          error: (err) => subscriber.error(err),
          complete: () => {
            if (fullResponse && dto.spaceId) {
              this.memory.appendToSession(userId, dto.spaceId, { role: 'assistant', content: fullResponse }).catch(() => {});
              this.memory.saveConversationTurn(userId, dto.spaceId, 'assistant', fullResponse, result.traceId).catch(() => {});
            }

            // Record AI Requests and Tokens usage asynchronously (only when spaceId known)
            if (dto.spaceId) {
              this.subscriptions.recordUsage(dto.spaceId, 'AI_REQUESTS').catch(() => {});
              if (tokensUsed > 0) {
                this.subscriptions.recordUsage(dto.spaceId, 'AI_TOKENS', tokensUsed).catch(() => {});
              }
            }

            subscriber.complete();
          },
        });
      });

      return { traceId: result.traceId, stream: trackedStream };
    }

    return result;
  }

  async analyzeRisk(userId: string, dto: RiskAnalysisDto): Promise<any> {
    const withinLimit = await this.subscriptions.checkQuota(dto.spaceId, 'AI_REQUESTS');
    if (!withinLimit) {
      throw new ForbiddenException('You have exceeded your monthly AI requests quota. Please upgrade.');
    }

    const result = await this.circuit.call(() => this.risk.analyzeRisk(userId, dto));

    if (result && !result.degraded && !result.fromCache) {
      await this.subscriptions.recordUsage(dto.spaceId, 'AI_REQUESTS');
      const tokensIn = result.metadata?.tokens_in ?? 0;
      const tokensOut = result.metadata?.tokens_out ?? 0;
      const totalTokens = tokensIn + tokensOut;
      if (totalTokens > 0) {
        await this.subscriptions.recordUsage(dto.spaceId, 'AI_TOKENS', totalTokens);
      }
    }

    return result;
  }

  async generateReport(userId: string, dto: ReportDto): Promise<any> {
    const withinLimit = await this.subscriptions.checkQuota(dto.spaceId, 'AI_REQUESTS');
    if (!withinLimit) {
      throw new ForbiddenException('You have exceeded your monthly AI requests quota. Please upgrade.');
    }

    const result = await this.circuit.call(() => this.llm.generateReport(userId, dto));

    if (result && !result.degraded) {
      await this.subscriptions.recordUsage(dto.spaceId, 'AI_REQUESTS');
      const tokensIn = result.metadata?.tokens_in ?? 0;
      const tokensOut = result.metadata?.tokens_out ?? 0;
      const totalTokens = tokensIn + tokensOut;
      if (totalTokens > 0) {
        await this.subscriptions.recordUsage(dto.spaceId, 'AI_TOKENS', totalTokens);
      }
    }

    return result;
  }

  async indexDocument(spaceId: string, taskId: string): Promise<void> {
    await this.rag.indexDocument(spaceId, taskId);
  }

  async retrieveContext(spaceId: string, query: string): Promise<string> {
    return this.rag.retrieveContext(spaceId, query);
  }

  async executeApprovedAction(actionId: string, reviewerId: string): Promise<ExecutionResult> {
    return this.executor.execute(actionId, reviewerId);
  }

  private sanitizeForPrompt(input: string): string {
    if (!input) return '';
    return input
      .replace(/\{\{.*?\}\}/g, '')
      .replace(/ignore (all )?(previous|prior) instructions?/gi, '[FILTERED]')
      .replace(/system:/gi, '[FILTERED]')
      .replace(/<\|.+?\|>/g, '')
      .slice(0, 2000);
  }
}

