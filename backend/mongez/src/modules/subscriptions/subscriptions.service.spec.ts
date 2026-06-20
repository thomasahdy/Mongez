import { SubscriptionsService } from './subscriptions.service';
import { QuotaService } from './quota.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;
  let quotaService: jest.Mocked<QuotaService>;

  beforeEach(() => {
    prisma = {
      space: {
        findUnique: jest.fn(),
      },
    };

    quotaService = {
      checkQuota: jest.fn(),
      recordUsage: jest.fn(),
      getUsage: jest.fn(),
    } as any;

    service = new SubscriptionsService(prisma as PrismaService, quotaService);
  });

  describe('getPlan()', () => {
    it('UT-SUB-001: should return space subscription plan tier and limits', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'PRO' },
      });

      const result = await service.getPlan('space-1');

      expect(result.tier).toBe('PRO');
      expect(result.limits.features).toContain('AI_CHAT');
      expect(prisma.space.findUnique).toHaveBeenCalledWith({
        where: { id: 'space-1' },
        select: { subscriptionPlan: { select: { name: true } } },
      });
    });

    it('should fallback to FREE tier and limits when space has no subscription plan', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: null,
      });

      const result = await service.getPlan('space-1');

      expect(result.tier).toBe('FREE');
      expect(result.limits.features).toEqual([]); // FREE tier has no features
    });
  });

  describe('canUseFeature()', () => {
    it('UT-SUB-002: should return true if plan tier supports feature, false otherwise', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'PRO' },
      });

      const canUseChat = await service.canUseFeature('space-1', 'AI_CHAT');
      expect(canUseChat).toBe(true);

      const canUseUnlimitedBoards = await service.canUseFeature('space-1', 'UNLIMITED_BOARDS');
      expect(canUseUnlimitedBoards).toBe(false); // PRO doesn't have UNLIMITED_BOARDS (ENTERPRISE only)
    });
  });

  describe('requireFeature()', () => {
    it('UT-SUB-003: should throw ForbiddenException if feature is not supported by space tier', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'FREE' },
      });

      await expect(service.requireFeature('space-1', 'AI_CHAT')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.requireFeature('space-1', 'AI_CHAT')).rejects.toThrow(
        'is not available on your current plan',
      );
    });

    it('should proceed silently if feature is supported by space tier', async () => {
      prisma.space.findUnique.mockResolvedValue({
        subscriptionPlan: { name: 'PRO' },
      });

      await expect(service.requireFeature('space-1', 'AI_CHAT')).resolves.toBeUndefined();
    });
  });

  describe('Delegations to QuotaService', () => {
    it('UT-SUB-004: should delegate checkQuota, recordUsage, and getUsage to QuotaService', async () => {
      quotaService.checkQuota.mockResolvedValue(true);
      quotaService.recordUsage.mockResolvedValue(undefined);
      quotaService.getUsage.mockResolvedValue({ usage: {} } as any);

      const checkVal = await service.checkQuota('space-1', 'AI_REQUESTS', 1);
      expect(checkVal).toBe(true);
      expect(quotaService.checkQuota).toHaveBeenCalledWith('space-1', 'AI_REQUESTS', 1);

      await service.recordUsage('space-1', 'AI_REQUESTS', 2);
      expect(quotaService.recordUsage).toHaveBeenCalledWith('space-1', 'AI_REQUESTS', 2);

      const usageResult = await service.getUsage('space-1', 15);
      expect(usageResult).toEqual({ usage: {} });
      expect(quotaService.getUsage).toHaveBeenCalledWith('space-1', 15);
    });
  });
});
