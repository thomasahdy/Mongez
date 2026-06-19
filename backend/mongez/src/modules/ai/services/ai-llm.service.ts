import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { AIClientService } from '../ai-client.service';
import { AIRequestRepository } from '../repositories/ai-request.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChatDto } from '../dto/chat.dto';
import { ReportDto } from '../dto/report.dto';

interface ResolvedUserContext {
  userName: string;
  userRole: string;
  spaceName: string;
  boardName: string;
}

@Injectable()
export class AILlmService {
  private readonly logger = new Logger(AILlmService.name);

  constructor(
    private readonly aiClient: AIClientService,
    private readonly requestRepo: AIRequestRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveUserContext(
    userId: string,
    spaceId: string,
    boardId?: string,
  ): Promise<ResolvedUserContext> {
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

  async chat(userId: string, dto: ChatDto & { memoryContext: string }): Promise<any> {
    const traceId = randomUUID();

    // 1. Create tracking record
    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'chat',
      rawInput: dto.message,
    });

    const context = await this.resolveUserContext(userId, dto.spaceId, dto.boardId);

    try {
      const startTime = Date.now();
      // Forward request with memoryContext appended or passed along
      const enrichedMessage = dto.memoryContext
        ? `${dto.memoryContext}\n\nUser request: ${dto.message}`
        : dto.message;

      const result = await this.aiClient.chat({
        traceId,
        userId,
        spaceId: dto.spaceId,
        message: enrichedMessage,
        userName: context.userName,
        userRole: context.userRole,
        spaceName: context.spaceName,
        boardName: context.boardName,
      });

      const latencyMs = Date.now() - startTime;

      await this.requestRepo.update(traceId, {
        intent: result.intent ?? 'chat',
        finalResponse: result.response,
        modelUsed: result.metadata?.model,
        tokensIn: result.metadata?.tokens_in,
        tokensOut: result.metadata?.tokens_out,
        latencyMs,
        status: 'completed',
      });

      return { traceId, ...result };
    } catch (error: any) {
      this.logger.error(`[${traceId}] Chat AI call failed: ${error.message}`);
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

  async chatStream(
    userId: string,
    dto: ChatDto,
  ): Promise<{ traceId: string; stream: Observable<string> }> {
    const traceId = randomUUID();

    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'chat',
      rawInput: dto.message,
    });

    const context = await this.resolveUserContext(userId, dto.spaceId, dto.boardId);
    const startTime = Date.now();

    const stream = this.aiClient.streamChat({
      traceId,
      userId,
      spaceId: dto.spaceId,
      message: dto.message,
      userName: context.userName,
      userRole: context.userRole,
      spaceName: context.spaceName,
      boardName: context.boardName,
    });

    let fullResponse = '';
    let detectedIntent = '';

    const trackedStream = new Observable<string>((subscriber) => {
      stream.subscribe({
        next: (chunk) => {
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.token) {
              fullResponse += parsed.token;
            }
            if (parsed.intent) {
              detectedIntent = parsed.intent;
            }
            if (parsed.metadata) {
              this.requestRepo
                .update(traceId, {
                  intent: parsed.metadata.intent ?? detectedIntent ?? 'chat',
                  finalResponse: fullResponse,
                  tokensOut: parsed.metadata.tokens_out,
                  latencyMs: Date.now() - startTime,
                  ttftMs: parsed.metadata.ttft_ms,
                  status: 'completed',
                })
                .catch((err) =>
                  this.logger.error(
                    `[${traceId}] Failed to update stream tracking: ${err.message}`,
                  ),
                );
            }
          } catch {
            // Non-JSON chunk — pass through
          }
          subscriber.next(chunk);
        },
        error: (err) => {
          this.requestRepo
            .update(traceId, {
              status: 'failed',
              errorMessage: err.message,
            })
            .catch(() => {});
          subscriber.error(err);
        },
        complete: () => subscriber.complete(),
      });
    });

    return { traceId, stream: trackedStream };
  }

  async generateReport(userId: string, dto: ReportDto): Promise<any> {
    const traceId = randomUUID();
    const rawInput = `reportType=${dto.reportType ?? 'weekly'} boardId=${dto.boardId ?? 'all'}`;

    await this.requestRepo.create({
      traceId,
      userId,
      spaceId: dto.spaceId,
      intent: 'report',
      rawInput,
    });

    const context = await this.resolveUserContext(userId, dto.spaceId, dto.boardId);

    try {
      const startTime = Date.now();
      const result = await this.aiClient.generateReport({
        traceId,
        userId,
        spaceId: dto.spaceId,
        userName: context.userName,
        userRole: context.userRole,
        spaceName: context.spaceName,
        boardName: context.boardName,
        query: `Generate a ${dto.reportType ?? 'weekly'} project status report`,
      });

      const latencyMs = Date.now() - startTime;

      await this.requestRepo.update(traceId, {
        finalResponse: result.report || result.response,
        modelUsed: result.metadata?.model,
        tokensIn: result.metadata?.tokens_in,
        tokensOut: result.metadata?.tokens_out,
        latencyMs,
        status: 'completed',
      });

      return { traceId, ...result };
    } catch (error: any) {
      this.logger.error(`[${traceId}] Report generation failed: ${error.message}`);
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
