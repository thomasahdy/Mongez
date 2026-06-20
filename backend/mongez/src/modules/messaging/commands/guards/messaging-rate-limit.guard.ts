import {
  Injectable,
  CanActivate,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CacheService } from '../../../../infrastructure/cache/cache.service';

/**
 * MessagingRateLimitGuard — Token-bucket rate limiter for inbound messaging.
 *
 * Enforces max 30 commands per minute per user.
 * Uses Redis as the backing store for distributed rate limiting.
 *
 * The guard checks before any command execution and throws ForbiddenException
 * when the limit is exceeded.
 */
@Injectable()
export class MessagingRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(MessagingRateLimitGuard.name);

  // Rate limit: 10 commands per minute
  private readonly MAX_REQUESTS = 10;
  private readonly WINDOW_SECONDS = 60;

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Check if a user's rate limit is within bounds.
   * Increments the bucket atomically and returns true if request is allowed.
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const key = `rate_limit:messaging:${userId}`;
    try {
      const count = await this.cacheService.incr(key, this.WINDOW_SECONDS);
      return count <= this.MAX_REQUESTS;
    } catch (error) {
      this.logger.error(`Rate limit check failed for user ${userId}:`, error);
      return true; // Fail-open to avoid blocking chat traffic
    }
  }

  async canActivate(context: any): Promise<boolean> {
    // Extract userId from the request context (set by webhook handlers)
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId || request.userId;

    if (!userId) {
      // No user context — allow through (will be handled elsewhere)
      return true;
    }

    const key = `rate_limit:messaging:${userId}`;

    try {
      // Increment count atomically using CacheService.incr
      const count = await this.cacheService.incr(key, this.WINDOW_SECONDS);

      if (count > this.MAX_REQUESTS) {
        this.logger.warn(`Rate limit exceeded for user ${userId}`);
        throw new ForbiddenException(
          'Too many requests. Please wait a moment before trying again.',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // On cache errors, allow through (fail-open to avoid blocking all messaging)
      this.logger.error(`Rate limit check failed for user ${userId}:`, error);
      return true;
    }
  }

  /**
   * Reset the rate limit for a user (useful for testing or manual overrides).
   *
   * @param userId User ID
   */
  async resetRateLimit(userId: string): Promise<void> {
    const key = `rate_limit:messaging:${userId}`;
    await this.cacheService.del(key);
    this.logger.log(`Rate limit reset for user ${userId}`);
  }

  /**
   * Get remaining requests for a user.
   *
   * @param userId User ID
   * @returns Number of remaining requests in the current window
   */
  async getRemainingRequests(userId: string): Promise<number> {
    const key = `rate_limit:messaging:${userId}`;
    const countStr = await this.cacheService.get<string>(key);
    const count = countStr ? parseInt(countStr, 10) : 0;
    return Math.max(0, this.MAX_REQUESTS - count);
  }
}
