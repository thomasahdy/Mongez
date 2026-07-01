import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreateAIChatSessionDto {
  id?: string;
  title: string;
  context?: Prisma.InputJsonValue;
  messages: Prisma.InputJsonValue;
}

export interface UpdateAIChatSessionDto {
  title?: string;
  context?: Prisma.InputJsonValue;
  messages?: Prisma.InputJsonValue;
}

@Injectable()
export class AIChatSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateAIChatSessionDto) {
    return this.prisma.aiChatSession.create({
      data: {
        id: data.id,
        userId,
        title: data.title,
        context: data.context,
        messages: data.messages,
      },
    });
  }

  findById(id: string) {
    return this.prisma.aiChatSession.findUnique({
      where: { id },
    });
  }

  findByUser(userId: string) {
    return this.prisma.aiChatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  update(id: string, userId: string, data: UpdateAIChatSessionDto) {
    return this.prisma.aiChatSession.update({
      where: { id, userId },
      data,
    });
  }

  delete(id: string, userId: string) {
    return this.prisma.aiChatSession.delete({
      where: { id, userId },
    });
  }
}
