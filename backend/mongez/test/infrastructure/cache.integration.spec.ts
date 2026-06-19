import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../src/infrastructure/cache/cache.service';
import { AppModule } from '../../src/app.module';

describe('CacheService (Integration)', () => {
  let cacheService: CacheService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    cacheService = moduleRef.get(CacheService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    // Clear all keys in test Redis database
    const redis = (cacheService as any).redis;
    await redis.flushdb();
  });

  it('IT-CACHE-002: should return null for missing key and cached value for existing key', async () => {
    const key = 'test:missing';
    const val = await cacheService.get(key);
    expect(val).toBeNull();

    await cacheService.set('test:existing', { hello: 'world' });
    const cached = await cacheService.get<{ hello: string }>('test:existing');
    expect(cached).toEqual({ hello: 'world' });
  });

  it('IT-CACHE-003: should set values with TTL', async () => {
    const key = 'test:ttl';
    await cacheService.set(key, 'value', 2); // 2 seconds TTL
    
    expect(await cacheService.get(key)).toBe('value');
    
    // Check key TTL in Redis
    const redis = (cacheService as any).redis;
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2);
  });

  it('IT-CACHE-004: should delete keys', async () => {
    await cacheService.set('test:delete', 'data');
    expect(await cacheService.exists('test:delete')).toBe(true);

    await cacheService.del('test:delete');
    expect(await cacheService.exists('test:delete')).toBe(false);
  });

  it('IT-CACHE-005: should delete by pattern wildcard', async () => {
    await cacheService.set('entity:1', 'a');
    await cacheService.set('entity:2', 'b');
    await cacheService.set('other:1', 'c');

    await cacheService.delPattern('entity:*');

    expect(await cacheService.exists('entity:1')).toBe(false);
    expect(await cacheService.exists('entity:2')).toBe(false);
    expect(await cacheService.exists('other:1')).toBe(true);
  });

  it('IT-CACHE-006: should implement getOrSet logic', async () => {
    const key = 'test:getorset';
    const factory = jest.fn().mockResolvedValue('computed-value');

    // 1. First call computes and caches
    const res1 = await cacheService.getOrSet(key, factory, 10);
    expect(res1).toBe('computed-value');
    expect(factory).toHaveBeenCalledTimes(1);

    // 2. Second call returns cached without invoking factory
    const res2 = await cacheService.getOrSet(key, factory, 10);
    expect(res2).toBe('computed-value');
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
