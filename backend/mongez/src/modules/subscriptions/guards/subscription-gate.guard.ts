import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { FeatureKey, SubscriptionsService } from '../subscriptions.service';

/**
 * Feature gate guard — checks subscription plan for a required feature.
 * Apply alongside @RequiresFeature('FEATURE') decorator.
 *
 * Example:
 *   @Post('chat')
 *   @RequiresFeature('AI_CHAT')
 *   @UseGuards(JwtAuthGuard, SubscriptionGateGuard)
 */
@Injectable()
export class SubscriptionGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionsService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true; // No feature required → allow

    const store = this.tenant.getStore();
    let spaceId = store?.spaceId;
    if (!spaceId) {
      const request = context.switchToHttp().getRequest();
      spaceId = request.body?.spaceId ?? request.query?.spaceId ?? request.params?.spaceId;
    }
    if (!spaceId) {
      throw new ForbiddenException('Cannot resolve tenant for subscription check.');
    }

    return this.subscriptions.canUseFeature(spaceId, feature);
  }
}