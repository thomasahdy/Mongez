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
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
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
}