import { ApprovalsService } from './approvals.service';
import { ApprovalRepository } from './repositories/approval.repository';
import { Queue } from 'bullmq';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let approvalRepo: jest.Mocked<ApprovalRepository>;
  let notificationsQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    approvalRepo = {
      findPendingForTask: jest.fn(),
      findPendingForReviewer: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      resolve: jest.fn(),
      withdraw: jest.fn(),
      listForTask: jest.fn(),
    } as any;

    notificationsQueue = {
      add: jest.fn(),
    } as any;

    service = new ApprovalsService(approvalRepo, notificationsQueue);
  });

  describe('requestApproval()', () => {
    it('should throw ConflictException if a pending approval already exists for task', async () => {
      approvalRepo.findPendingForTask.mockResolvedValue({ id: 'app-1' } as any);

      const dto = { taskId: 'task-1', reviewerId: 'user-2', note: 'Please review' };
      await expect(service.requestApproval(dto, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('should successfully create an approval and queue a notification', async () => {
      approvalRepo.findPendingForTask.mockResolvedValue(null);
      const mockApproval = { id: 'app-1', taskId: 'task-1', requestedById: 'user-1', reviewerId: 'user-2' };
      approvalRepo.create.mockResolvedValue(mockApproval as any);

      const dto = { taskId: 'task-1', reviewerId: 'user-2', note: 'Please review' };
      const result = await service.requestApproval(dto, 'user-1');

      expect(result).toEqual(mockApproval);
      expect(approvalRepo.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        requesterId: 'user-1',
        reviewerId: 'user-2',
        note: 'Please review',
      });
      expect(notificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('resolve()', () => {
    it('should resolve the approval and queue a notification', async () => {
      const mockResolved = { id: 'app-1', taskId: 'task-1', requestedById: 'user-1', reviewerId: 'user-2', status: ApprovalStatus.APPROVED };
      approvalRepo.resolve.mockResolvedValue(mockResolved as any);

      const dto = { status: 'APPROVED' as const, comment: 'Looks good' };
      const result = await service.resolve('app-1', 'user-2', dto);

      expect(result).toEqual(mockResolved);
      expect(approvalRepo.resolve).toHaveBeenCalledWith('app-1', 'user-2', ApprovalStatus.APPROVED, 'Looks good');
      expect(notificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('withdraw()', () => {
    it('should withdraw a pending approval', async () => {
      approvalRepo.withdraw.mockResolvedValue({ id: 'app-1', status: ApprovalStatus.WITHDRAWN } as any);
      const result = await service.withdraw('app-1', 'user-1');
      expect(result.status).toBe(ApprovalStatus.WITHDRAWN);
      expect(approvalRepo.withdraw).toHaveBeenCalledWith('app-1', 'user-1');
    });
  });

  describe('getPendingForReviewer()', () => {
    it('should return paginated pending approvals for reviewer', async () => {
      approvalRepo.findPendingForReviewer.mockResolvedValue({
        data: [{ id: 'app-1' }],
        total: 1,
      } as any);

      const result = await service.getPendingForReviewer('user-1', 1, 10);

      expect(approvalRepo.findPendingForReviewer).toHaveBeenCalledWith('user-1', 1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('listForTask()', () => {
    it('should return paginated list of approvals for task', async () => {
      approvalRepo.listForTask.mockResolvedValue({
        data: [{ id: 'app-1' }],
        total: 1,
      } as any);

      const result = await service.listForTask('task-1', 1, 10);

      expect(approvalRepo.listForTask).toHaveBeenCalledWith('task-1', 1, 10);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findById()', () => {
    it('should return approval record if found', async () => {
      const mockApproval = { id: 'app-1' };
      approvalRepo.findById.mockResolvedValue(mockApproval as any);

      const result = await service.findById('app-1');

      expect(result).toEqual(mockApproval);
      expect(approvalRepo.findById).toHaveBeenCalledWith('app-1');
    });

    it('should throw NotFoundException if approval not found', async () => {
      approvalRepo.findById.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
