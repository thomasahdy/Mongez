import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FeatureKey, UsageMetric, PlanLimits, TIER_LIMITS } from './plan-limits';
export type { FeatureKey, UsageMetric, PlanLimits };
export { TIER_LIMITS };
import { QuotaService } from './quota.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * Resolve the active plan for a space. Falls back to FREE if unset.
   */
  async getPlan(spaceId: string): Promise<{ tier: string; limits: PlanLimits }> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { subscriptionPlan: { select: { name: true } } },
    });

    const tier = space?.subscriptionPlan?.name ?? 'FREE';
    return { tier, limits: TIER_LIMITS[tier] ?? TIER_LIMITS.FREE };
  }

  /**
   * Check whether a feature is enabled for the space's plan.
   */
  async canUseFeature(spaceId: string, feature: FeatureKey): Promise<boolean> {
    const { limits } = await this.getPlan(spaceId);
    return limits.features.includes(feature);
  }

  /**
   * Require a feature — throws ForbiddenException if not available.
   */
  async requireFeature(spaceId: string, feature: FeatureKey): Promise<void> {
    if (!(await this.canUseFeature(spaceId, feature))) {
      throw new ForbiddenException(
        `Feature "${feature}" is not available on your current plan. Please upgrade.`,
      );
    }
  }

  /**
   * Check whether a usage quota has been exceeded for the current period.
   * Delegates to QuotaService.
   */
  async checkQuota(spaceId: string, metric: UsageMetric, increment = 0): Promise<boolean> {
    return this.quotaService.checkQuota(spaceId, metric, increment);
  }

  /**
   * Record usage for metering/billing.
   * Delegates to QuotaService.
   */
  async recordUsage(spaceId: string, metric: UsageMetric, value = 1): Promise<void> {
    return this.quotaService.recordUsage(spaceId, metric, value);
  }

  /**
   * Get usage breakdown for the billing/usage dashboard.
   * Delegates to QuotaService.
   */
  async getUsage(spaceId: string, periodDays = 30) {
    return this.quotaService.getUsage(spaceId, periodDays);
  }
}