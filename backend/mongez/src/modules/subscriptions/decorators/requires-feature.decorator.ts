import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../subscriptions.service';

export const FEATURE_KEY = 'requiredFeature';

/**
 * Decorate a route to require a specific subscription feature.
 * Must be combined with @UseGuards(SubscriptionGateGuard).
 */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);