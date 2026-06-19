import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

/**
 * Redis-backed rate limiter for AI endpoints supporting per-tier limits.
 * Limits each user to a minute-window quota and daily-window quota depending on space plan tier.
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptions: SubscriptionsService,
    private readonly cache: CacheService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.userId ?? request.user?.id ?? request.ip ?? 'anonymous';

    // Try to resolve space ID from tenant context or request
    const store = this.tenant.getStore();
    let spaceId = store?.spaceId;
    if (!spaceId) {
      spaceId = request.body?.spaceId ?? request.query?.spaceId ?? request.params?.spaceId;
    }

    let tier = 'FREE';
    if (spaceId) {
      try {
        const plan = await this.subscriptions.getPlan(spaceId);
        tier = plan.tier;
      } catch (err) {
        // Fallback to FREE if plan resolution fails
      }
    }

    const limits = {
      FREE: { perMinute: 5, perDay: 20 },
      PRO: { perMinute: 30, perDay: 200 },
      ENTERPRISE: { perMinute: 100, perDay: 1000 },
    };
    const limit = limits[tier as keyof typeof limits] ?? limits.FREE;

    // Use current timestamp/date for Redis rate limiting keys
    const now = Date.now();
    const minuteWindow = Math.floor(now / 60000);
    const dayString = new Date(now).toISOString().slice(0, 10);

    const minuteKey = `rate:ai:${userId}:${minuteWindow}`;
    const dayKey = `rate:ai:${userId}:${dayString}`;

    let minuteCount = 0;
    let dayCount = 0;

    try {
      [minuteCount, dayCount] = await Promise.all([
        this.cache.incr(minuteKey, 60),
        this.cache.incr(dayKey, 86400),
      ]);
    } catch (err) {
      // If Cache service is down, fail open to avoid complete outage
      return true;
    }

    if (minuteCount > limit.perMinute || dayCount > limit.perDay) {
      const resetAt = (minuteWindow + 1) * 60000;
      throw new HttpException(
        {
          statusCode: 429,
          message: `AI rate limit exceeded. Max ${limit.perMinute} requests per minute or ${limit.perDay} requests per day.`,
          retryAfterMs: Math.max(0, resetAt - now),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

