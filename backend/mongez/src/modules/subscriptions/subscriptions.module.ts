import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { QuotaService } from './quota.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionGateGuard } from './guards/subscription-gate.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, QuotaService, SubscriptionGateGuard, SpaceMemberGuard],
  exports: [SubscriptionsService, QuotaService, SubscriptionGateGuard],
})
export class SubscriptionsModule {}