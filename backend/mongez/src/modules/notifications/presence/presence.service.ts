import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../infrastructure/cache/cache.service';

@Injectable()
export class PresenceService {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Called whenever a user connects or emits a 'heartbeat' event over WebSocket
   */
  async recordHeartbeat(userId: string) {
    // Set a TTL of 60 seconds. Redis handles the expiration automatically.
    await this.cacheService.set(`user:${userId}:last_seen`, new Date().toISOString(), 60);
  }

  /**
   * Checks if the user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    return this.cacheService.exists(`user:${userId}:last_seen`);
  }
}
