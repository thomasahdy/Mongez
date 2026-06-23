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
        status: 'PENDING',
      },
    });
  }

  /**
   * Used by the Relay Worker to fetch pending events.
   * Employs "FOR UPDATE SKIP LOCKED" and atomically transitions status to "PROCESSING"
   * to guarantee horizontal scaling safety across multiple API servers.
   */
  async getUnprocessedEvents(limit: number = 100): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(
      `UPDATE "outbox_events"
       SET "status" = 'PROCESSING'::"OutboxStatus"
       WHERE "id" IN (
         SELECT "id" FROM "outbox_events"
         WHERE "status" = 'PENDING'::"OutboxStatus"
         ORDER BY "createdAt" ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *;`,
      limit,
    ) as Promise<any[]>;
  }

  async markAsProcessed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
      },
    });
  }

  async revertToPending(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
      },
    });
  }
}
