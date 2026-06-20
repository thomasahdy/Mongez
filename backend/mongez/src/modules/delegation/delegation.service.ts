import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class DelegationService {
  constructor(private readonly prisma: PrismaService) {}

  async createDelegation(
    userId: string,
    spaceId: string,
    delegateId: string,
    startDateStr: string,
    endDateStr: string,
  ) {
    if (userId === delegateId) {
      throw new BadRequestException('You cannot delegate authority to yourself.');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    // Verify delegate is member of the space
    const delegateMembership = await this.prisma.membership.findFirst({
      where: { userId: delegateId, spaceId },
    });
    if (!delegateMembership) {
      throw new NotFoundException('The delegated user must be a member of this space.');
    }

    // Deactivate any existing active delegation for this space/user
    await this.prisma.userDelegation.updateMany({
      where: { userId, spaceId, isActive: true },
      data: { isActive: false },
    });

    return this.prisma.userDelegation.create({
      data: {
        userId,
        delegateId,
        spaceId,
        startDate,
        endDate,
        isActive: true,
      },
    });
  }

  async getActiveDelegate(userId: string, spaceId: string): Promise<string | null> {
    const now = new Date();
    const delegation = await this.prisma.userDelegation.findFirst({
      where: {
        userId,
        spaceId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    return delegation ? delegation.delegateId : null;
  }

  async getDelegations(userId: string, spaceId: string) {
    return this.prisma.userDelegation.findMany({
      where: { userId, spaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivateDelegation(id: string, userId: string) {
    const delegation = await this.prisma.userDelegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      throw new NotFoundException('Delegation not found.');
    }

    if (delegation.userId !== userId) {
      throw new ForbiddenException('You can only deactivate your own delegations.');
    }

    return this.prisma.userDelegation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

