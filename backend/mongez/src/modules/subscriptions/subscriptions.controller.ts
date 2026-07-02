import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, SpaceMemberGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plan')
  @ApiOperation({ summary: 'Get current plan for a space' })
  async getPlan(@Query('spaceId') spaceId: string) {
    return this.subscriptions.getPlan(spaceId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage metrics for a space (billing dashboard)' })
  async getUsage(
    @Query('spaceId') spaceId: string,
    @Query('periodDays') periodDays?: string,
  ) {
    return this.subscriptions.getUsage(spaceId, periodDays ? Number(periodDays) : 30);
  }
}