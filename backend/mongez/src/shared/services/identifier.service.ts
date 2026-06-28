import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class IdentifierService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next sequential identifier for a space atomically.
   * Uses a raw upsert-increment query so concurrent task creates never
   * produce duplicate identifiers, even under high load.
   *
   * @example nextIdentifier('clxyz...', 'MGZ') → 'MGZ-1', 'MGZ-2', ...
   */
  async nextIdentifier(spaceId: string, prefix: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;
    const result = await client.$queryRaw<[{ seq: number }]>`
      INSERT INTO "space_counters" ("spaceId", "seq")
      VALUES (${spaceId}, 1)
      ON CONFLICT ("spaceId")
      DO UPDATE SET "seq" = "space_counters"."seq" + 1
      RETURNING "seq"
    `;
    return `${prefix}-${result[0].seq}`;
  }
}
