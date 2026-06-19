import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ApprovalStatus } from '@prisma/client';

@Injectable()
export class ApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingForTask(taskId: string) {
    return this.prisma.approval.findFirst({
      where: { taskId, status: ApprovalStatus.PENDING },
    });
  }

  async findPendingForReviewer(reviewerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { reviewerId, status: ApprovalStatus.PENDING };
    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        skip,
        take: limit,
        include: {
          task: { select: { id: true, identifier: true, title: true } },
          requester: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.approval.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: { taskId: string; requesterId: string; reviewerId: string; note?: string }) {
    return this.prisma.approval.create({
      data: {
        taskId: data.taskId,
        requestedById: data.requesterId,
        reviewerId: data.reviewerId,
        comment: data.note, // Storing requester note in comment or map to field. Schema maps "comment" to note/comment
        status: ApprovalStatus.PENDING,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.approval.findUnique({
      where: { id },
      include: {
        task: true,
        requester: true,
        reviewer: true,
      },
    });
  }

  async resolve(id: string, reviewerId: string, status: ApprovalStatus, comment?: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval || approval.reviewerId !== reviewerId) {
      throw new ForbiddenException('Only the assigned reviewer can resolve this approval');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is already resolved');
    }
    return this.prisma.approval.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        comment: comment || approval.comment,
      },
    });
  }

  async withdraw(id: string, requesterId: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval || approval.requestedById !== requesterId) {
      throw new ForbiddenException('Only the requester can withdraw this approval');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Can only withdraw pending approvals');
    }
    return this.prisma.approval.update({
      where: { id },
      data: { status: ApprovalStatus.WITHDRAWN },
    });
  }

  async listForTask(taskId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { taskId };
    const [data, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        skip,
        take: limit,
        include: {
          requester: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.approval.count({ where }),
    ]);
    return { data, total };
  }
}
