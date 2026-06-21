import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UsageMetric, TIER_LIMITS } from './plan-limits';

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Resolve active plan and limits for a space.
   */
  private async getPlan(spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { subscriptionPlan: { select: { name: true } } },
    });

    const tier = space?.subscriptionPlan?.name ?? 'FREE';
    return { tier, limits: TIER_LIMITS[tier] ?? TIER_LIMITS.FREE };
  }

  private getTtlToEndOfMonth(): number {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.max(0, Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000));
  }

  /**
   * Check whether a usage quota has been exceeded.
   */
  async checkQuota(spaceId: string, metric: UsageMetric, increment = 0): Promise<boolean> {
    const { limits } = await this.getPlan(spaceId);
    const cap = limits.quotas[metric];
    if (cap === undefined) return true; // Unlimited

    const cacheKey = `quota:${spaceId}:${metric}`;
    let cachedVal = await this.cache.get<number>(cacheKey);

    if (cachedVal === null) {
      const periodStart = this.currentPeriodStart();
      const agg = await this.prisma.usageRecord.aggregate({
        where: { spaceId, metric, recordedAt: { gte: periodStart } },
        _sum: { value: true },
      });
      cachedVal = agg._sum.value ?? 0;
      await this.cache.set(cacheKey, cachedVal, this.getTtlToEndOfMonth());
    }

    const used = cachedVal + increment;
    return used <= cap;
  }

  /**
   * Record usage for metering/billing.
   */
  async recordUsage(spaceId: string, metric: UsageMetric, value = 1): Promise<void> {
    try {
      await this.prisma.usageRecord.create({
        data: { spaceId, metric, value },
      });

      const cacheKey = `quota:${spaceId}:${metric}`;
      if (await this.cache.exists(cacheKey)) {
        if (value === 1) {
          await this.cache.incr(cacheKey, this.getTtlToEndOfMonth());
        } else {
          const current = (await this.cache.get<number>(cacheKey)) ?? 0;
          await this.cache.set(cacheKey, current + value, this.getTtlToEndOfMonth());
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to record usage (${metric}): ${err.message}`);
    }
  }

  /**
   * Get usage breakdown for a space.
   */
  async getUsage(spaceId: string, periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 86400000);

    const records = await this.prisma.usageRecord.findMany({
      where: { spaceId, recordedAt: { gte: since } },
      select: { metric: true, value: true, recordedAt: true },
    });

    const summary: Record<string, number> = {};
    for (const r of records) {
      summary[r.metric] = (summary[r.metric] ?? 0) + r.value;
    }

    const { tier, limits } = await this.getPlan(spaceId);

    return {
      tier,
      periodDays,
      usage: summary,
      quotas: limits.quotas,
      features: limits.features,
    };
  }

  private currentPeriodStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
