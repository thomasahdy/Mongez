import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { ExecutionContext, HttpException } from '@nestjs/common';

describe('AiRateLimitGuard', () => {
  let guard: AiRateLimitGuard;
  let configService: jest.Mocked<ConfigService>;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;
  let cacheService: jest.Mocked<CacheService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;

    subscriptionsService = {
      getPlan: jest.fn(),
    } as any;

    cacheService = {
      incr: jest.fn(),
    } as any;

    tenantContextService = {
      getStore: jest.fn(),
    } as any;

    guard = new AiRateLimitGuard(
      configService,
      subscriptionsService,
      cacheService,
      tenantContextService,
    );
  });

  const createMockContext = (requestData: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestData,
      }),
    } as any;
  };

  it('should allow request if limits are not exceeded', async () => {
    tenantContextService.getStore.mockReturnValue({ spaceId: 'space-1', userId: 'user-1', role: 'MEMBER' });
    subscriptionsService.getPlan.mockResolvedValue({
      tier: 'FREE',
      limits: {
        maxSpaces: 1,
        maxUsers: 5,
        maxBoards: 3,
        aiEnabled: false,
        features: [],
        quotas: {},
      },
    });

    cacheService.incr.mockResolvedValueOnce(3); // minute count
    cacheService.incr.mockResolvedValueOnce(15); // daily count

    const context = createMockContext({
      user: { userId: 'user-1' },
      body: { spaceId: 'space-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(cacheService.incr).toHaveBeenCalledTimes(2);
  });

  it('should throw 429 if minute rate limit is exceeded', async () => {
    tenantContextService.getStore.mockReturnValue({ spaceId: 'space-1', userId: 'user-1', role: 'MEMBER' });
    subscriptionsService.getPlan.mockResolvedValue({
      tier: 'FREE',
      limits: {} as any,
    });

    cacheService.incr.mockResolvedValueOnce(6); // minute count (exceeds 5)
    cacheService.incr.mockResolvedValueOnce(10); // daily count

    const context = createMockContext({
      user: { userId: 'user-1' },
      body: { spaceId: 'space-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should throw 429 if daily rate limit is exceeded', async () => {
    tenantContextService.getStore.mockReturnValue({ spaceId: 'space-1', userId: 'user-1', role: 'MEMBER' });
    subscriptionsService.getPlan.mockResolvedValue({
      tier: 'FREE',
      limits: {} as any,
    });

    cacheService.incr.mockResolvedValueOnce(2); // minute count
    cacheService.incr.mockResolvedValueOnce(21); // daily count (exceeds 20)

    const context = createMockContext({
      user: { userId: 'user-1' },
      body: { spaceId: 'space-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
  });

  it('should enforce higher limits for PRO tier', async () => {
    tenantContextService.getStore.mockReturnValue({ spaceId: 'space-1', userId: 'user-1', role: 'MEMBER' });
    subscriptionsService.getPlan.mockResolvedValue({
      tier: 'PRO',
      limits: {} as any,
    });

    cacheService.incr.mockResolvedValueOnce(25); // minute count
    cacheService.incr.mockResolvedValueOnce(150); // daily count

    const context = createMockContext({
      user: { userId: 'user-1' },
      body: { spaceId: 'space-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should fail open if cache service throws an error', async () => {
    tenantContextService.getStore.mockReturnValue({ spaceId: 'space-1', userId: 'user-1', role: 'MEMBER' });
    subscriptionsService.getPlan.mockResolvedValue({
      tier: 'FREE',
      limits: {} as any,
    });

    cacheService.incr.mockRejectedValue(new Error('Redis connection failed'));

    const context = createMockContext({
      user: { userId: 'user-1' },
      body: { spaceId: 'space-1' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
