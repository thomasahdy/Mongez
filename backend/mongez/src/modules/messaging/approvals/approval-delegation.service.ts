import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface ActiveDelegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  toUserName: string;
  endsAt: Date;
}

/**
 * ApprovalDelegationService — manages approval delegation windows.
 *
 * When a user goes on vacation (or is otherwise unavailable), they can delegate
 * their approval responsibilities to another user within the same space.
 *
 * The service provides:
 *  - findActiveDelegate():  resolve the current delegate for a user (if any)
 *  - createDelegation():    set up a new delegation window
 *  - deactivateDelegation(): cancel an active delegation
 */
@Injectable()
export class ApprovalDelegationService {
  private readonly logger = new Logger(ApprovalDelegationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find the currently active delegate for a user in a space.
   * Returns null if no active delegation exists.
   */
  async findActiveDelegate(
    fromUserId: string,
    spaceId: string,
  ): Promise<ActiveDelegation | null> {
    const now = new Date();

    const delegation = await this.prisma.approvalDelegate.findFirst({
      where: {
        fromUserId,
        spaceId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!delegation) return null;

    const toUser = await this.prisma.user.findUnique({
      where: { id: delegation.toUserId },
      select: { name: true },
    });

    return {
      id: delegation.id,
      fromUserId: delegation.fromUserId,
      toUserId: delegation.toUserId,
      toUserName: toUser?.name ?? 'Unknown',
      endsAt: delegation.endsAt,
    };
  }

  /**
   * Create a new delegation window. Deactivates any existing active delegation
   * for the same user+space first.
   */
  async createDelegation(
    fromUserId: string,
    toUserId: string,
    spaceId: string,
    endsAt: Date,
  ): Promise<{ id: string }> {
    // Deactivate any existing delegation
    await this.prisma.approvalDelegate.updateMany({
      where: {
        fromUserId,
        spaceId,
        isActive: true,
      },
      data: { isActive: false },
    });

    const delegation = await this.prisma.approvalDelegate.create({
      data: {
        fromUserId,
        toUserId,
        spaceId,
        startsAt: new Date(),
        endsAt,
        isActive: true,
      },
    });

    this.logger.log(
      `Delegation created: ${fromUserId} → ${toUserId} in space ${spaceId} until ${endsAt.toISOString()}`,
    );

    return { id: delegation.id };
  }

  /**
   * Deactivate all active delegations for a user in a space.
   */
  async deactivateDelegation(
    fromUserId: string,
    spaceId: string,
  ): Promise<number> {
    const result = await this.prisma.approvalDelegate.updateMany({
      where: {
        fromUserId,
        spaceId,
        isActive: true,
      },
      data: { isActive: false },
    });

    return result.count;
  }

  /**
   * Resolve the effective reviewer for an approval. If the target user has
   * an active delegation, returns the delegate's userId instead.
   */
  async resolveEffectiveReviewer(
    reviewerId: string,
    spaceId: string,
  ): Promise<{ userId: string; isDelegated: boolean; originalUserId?: string }> {
    const delegation = await this.findActiveDelegate(reviewerId, spaceId);

    if (delegation) {
      this.logger.log(
        `Approval redirected: ${reviewerId} → delegate ${delegation.toUserId}`,
      );
      return {
        userId: delegation.toUserId,
        isDelegated: true,
        originalUserId: reviewerId,
      };
    }

    return { userId: reviewerId, isDelegated: false };
  }
}
