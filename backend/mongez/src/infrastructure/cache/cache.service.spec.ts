import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let redisMock: {
    get: jest.Mock;
    set: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
    exists: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(() => {
    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
    };

    service = new CacheService(redisMock as any);
  });

  describe('get()', () => {
    it('UT-CACHE-001: should return parsed JSON for existing key', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ name: 'test' }));

      const result = await service.get<{ name: string }>('test-key');

      expect(result).toEqual({ name: 'test' });
      expect(redisMock.get).toHaveBeenCalledWith('test-key');
    });

    it('UT-CACHE-002: should return null for missing key', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should gracefully handle Redis errors', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await service.get('failing-key');

      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('UT-CACHE-003: should call setex with TTL when ttlSeconds provided', async () => {
      await service.set('key', { data: 'value' }, 60);

      expect(redisMock.setex).toHaveBeenCalledWith('key', 60, JSON.stringify({ data: 'value' }));
    });

    it('should call set without TTL when no ttlSeconds', async () => {
      await service.set('key', { data: 'value' });

      expect(redisMock.set).toHaveBeenCalledWith('key', JSON.stringify({ data: 'value' }));
    });

    it('should gracefully handle Redis errors', async () => {
      redisMock.set.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.set('key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('del()', () => {
    it('UT-CACHE-004: should delete a key', async () => {
      redisMock.del.mockResolvedValue(1);

      await service.del('key');

      expect(redisMock.del).toHaveBeenCalledWith('key');
    });

    it('should gracefully handle Redis errors', async () => {
      redisMock.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.del('key')).resolves.toBeUndefined();
    });
  });

  describe('delPattern()', () => {
    it('UT-CACHE-005: should delete all matching keys', async () => {
      redisMock.keys.mockResolvedValue(['task:1', 'task:1:detail', 'task:1:meta']);
      redisMock.del.mockResolvedValue(3);

      await service.delPattern('task:1:*');

      expect(redisMock.keys).toHaveBeenCalledWith('task:1:*');
      expect(redisMock.del).toHaveBeenCalledWith('task:1', 'task:1:detail', 'task:1:meta');
    });

    it('should not call del when no keys match', async () => {
      redisMock.keys.mockResolvedValue([]);

      await service.delPattern('nomatch:*');

      expect(redisMock.del).not.toHaveBeenCalled();
    });

    it('should gracefully handle Redis errors', async () => {
      redisMock.keys.mockRejectedValue(new Error('Redis error'));

      await expect(service.delPattern('pattern:*')).resolves.toBeUndefined();
    });
  });

  describe('getOrSet()', () => {
    it('UT-CACHE-006: should return cached value when exists (factory NOT called)', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const factory = jest.fn();

      const result = await service.getOrSet('key', factory, 60);

      expect(result).toEqual({ cached: true });
      expect(factory).not.toHaveBeenCalled();
    });

    it('UT-CACHE-007: should call factory and cache when miss', async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.setex.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue({ fresh: true });

      const result = await service.getOrSet('key', factory, 60);

      expect(result).toEqual({ fresh: true });
      expect(factory).toHaveBeenCalled();
      expect(redisMock.setex).toHaveBeenCalledWith('key', 60, JSON.stringify({ fresh: true }));
    });

    it('should cache without TTL when ttlSeconds not provided', async () => {
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue('value');

      await service.getOrSet('key', factory);

      expect(redisMock.set).toHaveBeenCalledWith('key', JSON.stringify('value'));
    });
  });

  describe('invalidateEntity()', () => {
    it('UT-CACHE-008: should delete entity:id and entity:id:* patterns', async () => {
      redisMock.del.mockResolvedValue(1);
      redisMock.keys.mockResolvedValue(['task:123:detail']);

      await service.invalidateEntity('task', '123');

      expect(redisMock.del).toHaveBeenCalledWith('task:123');
      expect(redisMock.keys).toHaveBeenCalledWith('task:123:*');
    });
  });

  describe('invalidateEntityType()', () => {
    it('UT-CACHE-009: should delete all entity:* keys', async () => {
      redisMock.keys.mockResolvedValue(['task:1', 'task:2', 'task:3']);
      redisMock.del.mockResolvedValue(3);

      await service.invalidateEntityType('task');

      expect(redisMock.keys).toHaveBeenCalledWith('task:*');
      expect(redisMock.del).toHaveBeenCalledWith('task:1', 'task:2', 'task:3');
    });
  });

  describe('exists()', () => {
    it('UT-CACHE-010: should return true for existing key', async () => {
      redisMock.exists.mockResolvedValue(1);

      const result = await service.exists('existing-key');

      expect(result).toBe(true);
    });

    it('should return false for missing key', async () => {
      redisMock.exists.mockResolvedValue(0);

      const result = await service.exists('missing-key');

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      redisMock.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.exists('error-key');

      expect(result).toBe(false);
    });
  });

  describe('expire()', () => {
    it('UT-CACHE-011: should update TTL on existing key', async () => {
      redisMock.expire.mockResolvedValue(1);

      await service.expire('key', 300);

      expect(redisMock.expire).toHaveBeenCalledWith('key', 300);
    });

    it('should gracefully handle Redis errors', async () => {
      redisMock.expire.mockRejectedValue(new Error('Redis error'));

      await expect(service.expire('key', 300)).resolves.toBeUndefined();
    });
  });
});