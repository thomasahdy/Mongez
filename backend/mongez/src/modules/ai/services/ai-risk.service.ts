import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AIClientService } from '../ai-client.service';
import { AIRequestRepository } from '../repositories/ai-request.repository';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RiskAnalysisDto } from '../dto/risk-analysis.dto';

const AI_CACHE_TTL_SECONDS = 300;

@Injectable()
export class AIRiskService {
  private readonly logger = new Logger(AIRiskService.name);

  constructor(
    private readonly aiClient: AIClientService,
    private readonly requestRepo: AIRequestRepository,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveUserContext(
    userId: string,
    spaceId: string,
    boardId?: string,
  ): Promise<{ userName: string; userRole: string; spaceName: string; boardName: string }> {
    const [user, membership, space, board] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.membership.findUnique({
        where: { userId_spaceId: { userId, spaceId } },
        select: { role: { select: { name: true } } },
      }),
      this.prisma.space.findUnique({
        where: { id: spaceId },
        select: { name: true },
      }),
      boardId
        ? this.prisma.board.findUnique({
            where: { id: boardId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      userName: user?.name ?? 'Unknown User',
      userRole: membership?.role?.name ?? 'Member',
      spaceName: space?.name ?? 'Unknown Space',
      boardName: board?.name ?? 'All Boards',
    };
  }

  async analyzeRisk(userId: string, dto: RiskAnalysisDto): Promise<any> {
    const traceId = randomUUID();
    const rawInput = `boardId=${dto.boardId ?? 'all'} taskId=${dto.taskId ?? 'all'}`;

    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'risk',
      rawInput,
    });

    const cacheKey = `ai:risk:${dto.spaceId}:${dto.boardId ?? 'all'}:${dto.taskId ?? 'all'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      this.logger.log(`[${traceId}] Cache hit for risk analysis`);
      await this.requestRepo.update(traceId, {
        finalResponse: cached.response,
        status: 'completed',
        latencyMs: 0,
      });
      return { traceId, ...cached, fromCache: true };
    }

    const context = await this.resolveUserContext(userId, dto.spaceId, dto.boardId);

    try {
      const startTime = Date.now();
      const result = await this.aiClient.analyzeRisk({
        traceId,
        userId,
        spaceId: dto.spaceId,
        userName: context.userName,
        userRole: context.userRole,
        spaceName: context.spaceName,
        boardName: context.boardName,
        query: dto.taskId ? `Analyze risks for task ${dto.taskId}` : 'Analyze all risks in this project',
      });

      const latencyMs = Date.now() - startTime;

      await this.requestRepo.update(traceId, {
        finalResponse: result.response,
        modelUsed: result.metadata?.model,
        tokensIn: result.metadata?.tokens_in,
        tokensOut: result.metadata?.tokens_out,
        latencyMs,
        status: 'completed',
      });

      await this.cache.set(cacheKey, result, AI_CACHE_TTL_SECONDS);

      return { traceId, ...result };
    } catch (error: any) {
      this.logger.error(`[${traceId}] Risk analysis failed: ${error.message}`);
      await this.requestRepo.update(traceId, {
        status: 'failed',
        errorMessage: error.message,
      });
      throw new HttpException(
        'AI service unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
