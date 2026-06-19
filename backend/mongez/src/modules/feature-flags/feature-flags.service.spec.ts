import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    prisma = {
      featureFlag: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    service = new FeatureFlagsService(prisma, cache);
  });

  describe('isEnabled()', () => {
    it('should return false if flag does not exist in cache or database', async () => {
      cache.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(null);

      const result = await service.isEnabled('non-existent', { userId: 'user-1' });
      expect(result).toBe(false);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({ where: { key: 'non-existent' } });
    });

    it('should return false if flag is disabled', async () => {
      const mockFlag = { key: 'my-flag', isEnabled: false, rolloutPercent: 0, enabledFor: [] };
      cache.get.mockResolvedValue(null);
      prisma.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await service.isEnabled('my-flag', { userId: 'user-1' });
      expect(result).toBe(false);
    });

    it('should return true if enabled globally with no restrictions', async () => {
      const mockFlag = { key: 'my-flag', isEnabled: true, rolloutPercent: 0, enabledFor: [] };
      cache.get.mockResolvedValue(mockFlag);

      const result = await service.isEnabled('my-flag', { userId: 'user-1' });
      expect(result).toBe(true);
    });

    it('should return true if user or space is in enabledFor list', async () => {
      const mockFlag = { key: 'my-flag', isEnabled: true, rolloutPercent: 0, enabledFor: ['user-1'] };
      cache.get.mockResolvedValue(mockFlag);

      const resultUser = await service.isEnabled('my-flag', { userId: 'user-1' });
      const resultSpace = await service.isEnabled('my-flag', { spaceId: 'user-1' });
      const resultOther = await service.isEnabled('my-flag', { userId: 'user-2' });

      expect(resultUser).toBe(true);
      expect(resultSpace).toBe(true);
      expect(resultOther).toBe(false);
    });

    it('should deterministically rollout features based on md5 hashing of userId and flag', async () => {
      const mockFlag = { key: 'rollout-flag', isEnabled: true, rolloutPercent: 30, enabledFor: [] };
      cache.get.mockResolvedValue(mockFlag);

      const isEnabledUserA = await service.isEnabled('rollout-flag', { userId: 'user-A' });
      const isEnabledUserB = await service.isEnabled('rollout-flag', { userId: 'user-B' });
      const isEnabledUserC = await service.isEnabled('rollout-flag', { userId: 'user-C' });

      expect(await service.isEnabled('rollout-flag', { userId: 'user-A' })).toBe(isEnabledUserA);
      expect(await service.isEnabled('rollout-flag', { userId: 'user-B' })).toBe(isEnabledUserB);
      expect(await service.isEnabled('rollout-flag', { userId: 'user-C' })).toBe(isEnabledUserC);
    });
  });

  describe('CRUD Actions', () => {
    it('should create a feature flag and cache it', async () => {
      const dto = { key: 'new-flag', description: 'desc', isEnabled: true, rolloutPercent: 50, enabledFor: [] };
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.create.mockResolvedValue({ id: 'flag-1', ...dto });

      const result = await service.create(dto);
      expect(result.key).toBe('new-flag');
      expect(cache.set).toHaveBeenCalledWith('flag:new-flag', expect.any(Object), 60);
    });

    it('should throw ConflictException when creating existing flag', async () => {
      const dto = { key: 'existing-flag' };
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'existing-flag' } as any);

      await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
    });

    it('should update feature flag and cache', async () => {
      const dto = { description: 'new-desc', isEnabled: true, rolloutPercent: 10, enabledFor: [] };
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'flag-to-update' } as any);
      prisma.featureFlag.update.mockResolvedValue({ key: 'flag-to-update', ...dto } as any);

      const result = await service.update('flag-to-update', dto);
      expect(result.description).toBe('new-desc');
      expect(cache.set).toHaveBeenCalledWith('flag:flag-to-update', expect.any(Object), 60);
    });

    it('should throw NotFoundException when updating non-existent flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });

    it('should delete flag and invalidate cache', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'flag-to-delete' } as any);

      await service.delete('flag-to-delete');
      expect(prisma.featureFlag.delete).toHaveBeenCalledWith({ where: { key: 'flag-to-delete' } });
      expect(cache.del).toHaveBeenCalledWith('flag:flag-to-delete');
    });
  });
});
