import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreateAIActionDto {
  traceId: string;
  spaceId: string;
  commandType: string;
  payload: Prisma.InputJsonValue;
  reason: string;
}

@Injectable()
export class AIActionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAIActionDto) {
    return this.prisma.aiProposedAction.create({ data });
  }

  findById(id: string) {
    return this.prisma.aiProposedAction.findUnique({ where: { id } });
  }

  findPending(spaceId: string) {
    return this.prisma.aiProposedAction.findMany({
      where: { spaceId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  approve(id: string, reviewedById: string, reviewNote?: string) {
    return this.prisma.aiProposedAction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById,
        reviewedAt: new Date(),
      },
    });
  }

  reject(id: string, reviewedById: string, reviewNote?: string) {
    return this.prisma.aiProposedAction.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById,
        reviewedAt: new Date(),
      },
    });
  }
}
