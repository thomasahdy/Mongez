import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper method to create an OutboxEvent as part of an existing Prisma Transaction.
   * This guarantees the event is ONLY published if the primary database mutation succeeds.
   */
  async createEventTx(
    tx: Prisma.TransactionClient,
    data: { aggregateType: string; aggregateId: string; eventType: string; payload: any }
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        payload: data.payload,
      },
    });
  }

  /**
   * Used by the Relay Worker to fetch pending events.
   */
  async getUnprocessedEvents(limit: number = 100) {
    return this.prisma.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}
