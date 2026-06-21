import { QuotaService } from './quota.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { Logger } from '@nestjs/common';

describe('QuotaService', () => {
  let service: QuotaService;
  let prisma: any;
  let cache: any;

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

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
    };

    service = new QuotaService(prisma as PrismaService, cache as CacheService);
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

    it('UT-QUOTA-003a: should check Redis cache first and return cached value if present', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' },
      });
      cache.get.mockResolvedValue(10); // Cache hit

      const result = await service.checkQuota('space-1', 'AI_REQUESTS', 5);

      expect(result).toBe(true); // 10 + 5 = 15 <= 20
      expect(cache.get).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(prisma.usageRecord.aggregate).not.toHaveBeenCalled();
    });

    it('UT-QUOTA-003b: should query DB and write to Cache when Redis cache is empty', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' },
      });
      cache.get.mockResolvedValue(null); // Cache miss
      prisma.usageRecord.aggregate.mockResolvedValue({
        _sum: { value: 12 },
      });

      const result = await service.checkQuota('space-1', 'AI_REQUESTS', 5);

      expect(result).toBe(true); // 12 + 5 = 17 <= 20
      expect(cache.get).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(prisma.usageRecord.aggregate).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS', 12, expect.any(Number));
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

    it('UT-QUOTA-005a: should increment Redis cache when key exists', async () => {
      prisma.usageRecord.create.mockResolvedValue({});
      cache.exists.mockResolvedValue(true);

      await service.recordUsage('space-1', 'AI_REQUESTS', 1);

      expect(cache.exists).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(cache.incr).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS', expect.any(Number));
    });

    it('UT-QUOTA-005b: should update Cache with custom value when value > 1 and key exists', async () => {
      prisma.usageRecord.create.mockResolvedValue({});
      cache.exists.mockResolvedValue(true);
      cache.get.mockResolvedValue(10);

      await service.recordUsage('space-1', 'AI_REQUESTS', 5);

      expect(cache.exists).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(cache.get).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(cache.set).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS', 15, expect.any(Number));
    });

    it('UT-QUOTA-005c: should not increment/update Redis cache when key does not exist', async () => {
      prisma.usageRecord.create.mockResolvedValue({});
      cache.exists.mockResolvedValue(false);

      await service.recordUsage('space-1', 'AI_REQUESTS', 1);

      expect(cache.exists).toHaveBeenCalledWith('quota:space-1:AI_REQUESTS');
      expect(cache.incr).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
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
