import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ApprovalRepository } from './repositories/approval.repository';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';
import { ApprovalStatus } from '@prisma/client';
import { paginate } from '../../shared/dto/pagination.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly approvalRepo: ApprovalRepository,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  async requestApproval(dto: CreateApprovalDto, requesterId: string) {
    const existing = await this.approvalRepo.findPendingForTask(dto.taskId);
    if (existing) {
      throw new ConflictException('A pending approval already exists for this task');
    }

    const approval = await this.approvalRepo.create({
      taskId: dto.taskId,
      requesterId,
      reviewerId: dto.reviewerId,
      note: dto.note,
    });

    // Notify reviewer via BullMQ queue
    await this.notificationsQueue.add(JOB_NAMES.SEND_NOTIFICATION, {
      userId: dto.reviewerId,
      type: 'APPROVAL_REQUESTED',
      title: 'Approval Requested',
      body: `A task requires your approval`,
      deepLink: `/approvals/${approval.id}`,
    });

    return approval;
  }

  async resolve(id: string, reviewerId: string, dto: ResolveApprovalDto) {
    const status = dto.status as ApprovalStatus;
    const approval = await this.approvalRepo.resolve(id, reviewerId, status, dto.comment);

    // Notify requester
    await this.notificationsQueue.add(JOB_NAMES.SEND_NOTIFICATION, {
      userId: approval.requestedById,
      type: 'APPROVAL_RESOLVED',
      title: `Task ${dto.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      body: dto.comment || `Your approval request has been ${dto.status.toLowerCase()}`,
      deepLink: `/tasks/${approval.taskId}`,
    });

    return approval;
  }

  async withdraw(id: string, requesterId: string) {
    return this.approvalRepo.withdraw(id, requesterId);
  }

  async getPendingForReviewer(reviewerId: string, page = 1, limit = 20) {
    const { data, total } = await this.approvalRepo.findPendingForReviewer(reviewerId, page, limit);
    return paginate(data, total, page, limit);
  }

  async listForTask(taskId: string, page = 1, limit = 20) {
    const { data, total } = await this.approvalRepo.listForTask(taskId, page, limit);
    return paginate(data, total, page, limit);
  }

  async findById(id: string) {
    const approval = await this.approvalRepo.findById(id);
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    return approval;
  }
}
