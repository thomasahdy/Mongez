import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data === null) return null;
      return JSON.parse(data) as T;
    } catch (err: any) {
      this.logger.error(`Cache GET error for key "${key}": ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (err: any) {
      this.logger.error(`Cache SET error for key "${key}": ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: any) {
      this.logger.error(`Cache DEL error for key "${key}": ${err.message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.error(`Cache DELPATTERN error for pattern "${pattern}": ${err.message}`);
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const result = await factory();
    await this.set(key, result, ttlSeconds);
    return result;
  }

  async invalidateEntity(entity: string, id: string): Promise<void> {
    await this.del(`${entity}:${id}`);
    await this.delPattern(`${entity}:${id}:*`);
  }

  async invalidateEntityType(entity: string): Promise<void> {
    await this.delPattern(`${entity}:*`);
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch (err: any) {
      this.logger.error(`Cache EXISTS error for key "${key}": ${err.message}`);
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (err: any) {
      this.logger.error(`Cache EXPIRE error for key "${key}": ${err.message}`);
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1 && ttlSeconds) {
        await this.redis.expire(key, ttlSeconds);
      }
      return count;
    } catch (err: any) {
      this.logger.error(`Cache INCR error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.redis.zadd(key, score, member);
    } catch (err: any) {
      this.logger.error(`Cache ZADD error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async zrem(key: string, member: string): Promise<number> {
    try {
      return await this.redis.zrem(key, member);
    } catch (err: any) {
      this.logger.error(`Cache ZREM error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    try {
      return await this.redis.zremrangebyscore(key, min, max);
    } catch (err: any) {
      this.logger.error(`Cache ZREMRANGEBYSCORE error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.zrange(key, start, stop);
    } catch (err: any) {
      this.logger.error(`Cache ZRANGE error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.redis.hset(key, field, value);
    } catch (err: any) {
      this.logger.error(`Cache HSET error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (err: any) {
      this.logger.error(`Cache HGET error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (err: any) {
      this.logger.error(`Cache HGETALL error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      return await this.redis.hdel(key, field);
    } catch (err: any) {
      this.logger.error(`Cache HDEL error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      if (keys.length === 0) return [];
      return await this.redis.mget(keys);
    } catch (err: any) {
      this.logger.error(`Cache MGET error: ${err.message}`);
      throw err;
    }
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.rpush(key, ...values);
    } catch (err: any) {
      this.logger.error(`Cache RPUSH error for key "${key}": ${err.message}`);
      throw err;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.lrange(key, start, stop);
    } catch (err: any) {
      this.logger.error(`Cache LRANGE error for key "${key}": ${err.message}`);
      throw err;
    }
  }
}