import { AdminService } from './admin.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      aiRequest: {
        count: jest.fn(),
      },
      fileVersion: {
        aggregate: jest.fn(),
      },
      space: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      userSession: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (promises) => promises),
    };

    service = new AdminService(prisma as PrismaService);
  });

  describe('getStats()', () => {
    it('UT-ADMIN-STATS-001: should query DAU, MAU, AI requests, and storage aggregation', async () => {
      prisma.user.count
        .mockResolvedValueOnce(5) // DAU
        .mockResolvedValueOnce(25); // MAU
      prisma.aiRequest.count.mockResolvedValue(150);
      prisma.fileVersion.aggregate.mockResolvedValue({
        _sum: { fileSize: 1024n },
      });

      const result = await service.getStats();

      expect(prisma.user.count).toHaveBeenCalledTimes(2);
      expect(prisma.aiRequest.count).toHaveBeenCalled();
      expect(prisma.fileVersion.aggregate).toHaveBeenCalled();

      expect(result).toEqual({
        dau: 5,
        mau: 25,
        totalAIRequests: 150,
        storageUsedBytes: 1024,
      });
    });

    it('should handle missing storageAgg size gracefully', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.aiRequest.count.mockResolvedValue(0);
      prisma.fileVersion.aggregate.mockResolvedValue({
        _sum: { fileSize: null },
      });

      const result = await service.getStats();
      expect(result.storageUsedBytes).toBe(0);
    });
  });

  describe('listUsers()', () => {
    it('UT-ADMIN-LISTU-001: should return paginated list of users', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u-1', email: 'test@example.com' }]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.listUsers(1, 10);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.user.count).toHaveBeenCalled();
      expect(result).toEqual({
        users: [{ id: 'u-1', email: 'test@example.com' }],
        total: 1,
      });
    });
  });

  describe('listSpaces()', () => {
    it('UT-ADMIN-LISTS-001: should return paginated list of spaces', async () => {
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1', name: 'Space' }]);
      prisma.space.count.mockResolvedValue(1);

      const result = await service.listSpaces(2, 5);

      expect(prisma.space.findMany).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.space.count).toHaveBeenCalled();
      expect(result).toEqual({
        spaces: [{ id: 'space-1', name: 'Space' }],
        total: 1,
      });
    });
  });

  describe('suspendUser()', () => {
    it('UT-ADMIN-SUSPEND-001: should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.suspendUser('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('UT-ADMIN-SUSPEND-002: should update status to SUSPENDED and clear user sessions in transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await service.suspendUser('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: UserStatus.SUSPENDED },
      });
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('deleteSpace()', () => {
    it('UT-ADMIN-DELSPACE-001: should throw NotFoundException if space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.deleteSpace('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('UT-ADMIN-DELSPACE-002: should delete space successfully', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1' });

      await service.deleteSpace('space-1');

      expect(prisma.space.findUnique).toHaveBeenCalledWith({ where: { id: 'space-1' } });
      expect(prisma.space.delete).toHaveBeenCalledWith({ where: { id: 'space-1' } });
    });
  });
});
