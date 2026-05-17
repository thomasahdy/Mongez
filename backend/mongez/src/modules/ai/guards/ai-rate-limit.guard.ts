import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple in-memory rate limiter for AI endpoints.
 * Limits each user to `rateLimitPerMinute` requests per 60-second window.
 * In production, replace with Redis-backed sliding window (BullMQ limiter or ioredis).
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly requestCounts = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.id ?? request.ip ?? 'anonymous';
    const limit = this.configService.get<number>('ai.rateLimitPerMinute') ?? 30;
    const now = Date.now();
    const windowMs = 60_000;

    const entry = this.requestCounts.get(userId);

    if (!entry || now > entry.resetAt) {
      this.requestCounts.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      throw new HttpException(
        {
          statusCode: 429,
          message: `AI rate limit exceeded. Max ${limit} requests per minute.`,
          retryAfterMs: entry.resetAt - now,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
