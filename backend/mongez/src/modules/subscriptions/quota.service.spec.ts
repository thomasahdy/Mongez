import { QuotaService } from './quota.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Logger } from '@nestjs/common';

describe('QuotaService', () => {
  let service: QuotaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      space: {
        findUnique: jest.fn(),
      },
      usageRecord: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new QuotaService(prisma as PrismaService);
  });

  describe('checkQuota()', () => {
    it('UT-QUOTA-001: should return true when within limit', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' },
      });

      prisma.usageRecord.aggregate.mockResolvedValue({
        _sum: { value: 10 },
      });

      const result = await service.checkQuota('space-1', 'AI_REQUESTS', 5);

      expect(result).toBe(true); // 10 + 5 = 15 <= 20 (FREE limit)
      expect(prisma.usageRecord.aggregate).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          metric: 'AI_REQUESTS',
          recordedAt: { gte: expect.any(Date) },
        },
        _sum: { value: true },
      });
    });

    it('UT-QUOTA-002: should return false when limit exceeded', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' },
      });

      prisma.usageRecord.aggregate.mockResolvedValue({
        _sum: { value: 18 },
      });

      const result = await service.checkQuota('space-1', 'AI_REQUESTS', 3);

      expect(result).toBe(false); // 18 + 3 = 21 > 20
    });

    it('UT-QUOTA-003: should return true if metric is unlimited', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' }, // FREE has no limit defined for AI_TOKENS
      });

      const result = await service.checkQuota('space-1', 'AI_TOKENS', 100);

      expect(result).toBe(true);
      expect(prisma.usageRecord.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('recordUsage()', () => {
    it('UT-QUOTA-004: should insert usageRecord into database', async () => {
      prisma.usageRecord.create.mockResolvedValue({});

      await service.recordUsage('space-1', 'AI_REQUESTS', 5);

      expect(prisma.usageRecord.create).toHaveBeenCalledWith({
        data: { spaceId: 'space-1', metric: 'AI_REQUESTS', value: 5 },
      });
    });

    it('UT-QUOTA-005: should log error but not crash when database insertion fails', async () => {
      prisma.usageRecord.create.mockRejectedValue(new Error('DB connection reset'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      await expect(service.recordUsage('space-1', 'AI_REQUESTS', 5)).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record usage (AI_REQUESTS): DB connection reset'),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('getUsage()', () => {
    it('UT-QUOTA-006: should retrieve and aggregate usage records over the period', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'PRO' },
      });

      prisma.usageRecord.findMany.mockResolvedValue([
        { metric: 'AI_REQUESTS', value: 10, recordedAt: new Date() },
        { metric: 'AI_REQUESTS', value: 15, recordedAt: new Date() },
        { metric: 'STORAGE_MB', value: 50, recordedAt: new Date() },
      ]);

      const result = await service.getUsage('space-1', 30);

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          recordedAt: { gte: expect.any(Date) },
        },
        select: { metric: true, value: true, recordedAt: true },
      });

      expect(result.tier).toBe('PRO');
      expect(result.usage).toEqual({
        AI_REQUESTS: 25,
        STORAGE_MB: 50,
      });
      expect(result.features).toContain('AI_CHAT');
      expect(result.quotas).toHaveProperty('AI_REQUESTS', 200);
    });
  });
});
