import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreateAIRequestDto {
  traceId: string;
  userId: string;
  spaceId: string;
  intent: string;
  rawInput: string;
}

export interface UpdateAIRequestDto {
  intent?: string;
  rewrittenQuery?: string;
  finalResponse?: string;
  modelUsed?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  ttftMs?: number;
  qualityScore?: number;
  userFeedback?: number;
  feedbackNote?: string;
  status?: string;
  errorMessage?: string;
}

@Injectable()
export class AIRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAIRequestDto) {
    return this.prisma.aiRequest.create({ data });
  }

  findByTraceId(traceId: string) {
    return this.prisma.aiRequest.findUnique({ where: { traceId } });
  }

  findByUser(userId: string, page = 1, limit = 20) {
    return this.prisma.aiRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  listBySpace(spaceId: string, page = 1, limit = 20) {
    return this.prisma.aiRequest.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  update(traceId: string, data: UpdateAIRequestDto) {
    return this.prisma.aiRequest.update({ where: { traceId }, data });
  }
}
