import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';

@Injectable()
export class PresenceService {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Called whenever a user connects or emits a 'heartbeat' event over WebSocket.
   * Sets a 90s TTL — presence expires after 90s of inactivity.
   */
  async recordHeartbeat(userId: string, ttlSeconds = 90) {
    await this.cacheService.set(`user:${userId}:last_seen`, new Date().toISOString(), ttlSeconds);
  }

  /**
   * Set user as online (called on WebSocket connection).
   */
  async setUserOnline(userId: string, ttlSeconds = 90): Promise<void> {
    await this.recordHeartbeat(userId, ttlSeconds);
  }

  /**
   * Checks if the user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    return this.cacheService.exists(`user:${userId}:last_seen`);
  }
}
