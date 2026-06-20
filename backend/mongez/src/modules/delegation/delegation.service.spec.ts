import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DelegationService } from './delegation.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('DelegationService', () => {
  let service: DelegationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      membership: {
        findFirst: jest.fn(),
      },
      userDelegation: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    service = new DelegationService(prisma);
  });

  describe('createDelegation()', () => {
    it('should throw BadRequestException if delegating to self', async () => {
      await expect(
        service.createDelegation('user-1', 'space-1', 'user-1', '2026-06-20', '2026-06-21'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if end date is not after start date', async () => {
      await expect(
        service.createDelegation('user-1', 'space-1', 'user-2', '2026-06-20', '2026-06-20'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createDelegation('user-1', 'space-1', 'user-2', '2026-06-20', '2026-06-19'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if delegate is not a member of the space', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.createDelegation('user-1', 'space-1', 'user-2', '2026-06-20', '2026-06-21'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate existing active delegations and create a new one', async () => {
      prisma.membership.findFirst.mockResolvedValue({ id: 'mem-1' } as any);
      prisma.userDelegation.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.userDelegation.create.mockResolvedValue({ id: 'del-1' } as any);

      const result = await service.createDelegation('user-1', 'space-1', 'user-2', '2026-06-20T10:00:00Z', '2026-06-21T10:00:00Z');

      expect(prisma.userDelegation.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', spaceId: 'space-1', isActive: true },
        data: { isActive: false },
      });
      expect(prisma.userDelegation.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          delegateId: 'user-2',
          spaceId: 'space-1',
          startDate: new Date('2026-06-20T10:00:00Z'),
          endDate: new Date('2026-06-21T10:00:00Z'),
          isActive: true,
        },
      });
      expect(result).toEqual({ id: 'del-1' });
    });
  });

  describe('getActiveDelegate()', () => {
    it('should return delegateId if active delegation exists within date range', async () => {
      prisma.userDelegation.findFirst.mockResolvedValue({ delegateId: 'user-2' } as any);

      const delegateId = await service.getActiveDelegate('user-1', 'space-1');

      expect(prisma.userDelegation.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          spaceId: 'space-1',
          isActive: true,
          startDate: { lte: expect.any(Date) },
          endDate: { gte: expect.any(Date) },
        },
      });
      expect(delegateId).toBe('user-2');
    });

    it('should return null if no active delegation exists', async () => {
      prisma.userDelegation.findFirst.mockResolvedValue(null);

      const delegateId = await service.getActiveDelegate('user-1', 'space-1');

      expect(delegateId).toBeNull();
    });
  });

  describe('getDelegations()', () => {
    it('should retrieve list of delegations ordered by creation date', async () => {
      const list = [{ id: 'del-1' }];
      prisma.userDelegation.findMany.mockResolvedValue(list as any);

      const result = await service.getDelegations('user-1', 'space-1');

      expect(prisma.userDelegation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', spaceId: 'space-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(list);
    });
  });

  describe('deactivateDelegation()', () => {
    it('should throw NotFoundException if delegation not found', async () => {
      prisma.userDelegation.findUnique.mockResolvedValue(null);

      await expect(service.deactivateDelegation('del-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if deactivating someone else\'s delegation', async () => {
      prisma.userDelegation.findUnique.mockResolvedValue({ id: 'del-1', userId: 'user-2' } as any);

      await expect(service.deactivateDelegation('del-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should deactivate delegation successfully', async () => {
      prisma.userDelegation.findUnique.mockResolvedValue({ id: 'del-1', userId: 'user-1' } as any);
      prisma.userDelegation.update.mockResolvedValue({ id: 'del-1', isActive: false } as any);

      const result = await service.deactivateDelegation('del-1', 'user-1');

      expect(prisma.userDelegation.update).toHaveBeenCalledWith({
        where: { id: 'del-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
