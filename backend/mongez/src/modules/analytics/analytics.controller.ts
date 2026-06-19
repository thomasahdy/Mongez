import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('analytics/overview')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'Project health score + key KPIs' })
  async getOverview(@Query('spaceId') spaceId: string) {
    return this.analytics.getOverview(spaceId);
  }

  @Get('analytics/tasks')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'Task velocity & completion rate' })
  async getTaskMetrics(
    @Query('spaceId') spaceId: string,
    @Query('boardId') _boardId: string,
    @Query('period') period: string,
  ) {
    return this.analytics.getTaskMetrics(spaceId, this.toPeriod(period));
  }

  @Get('analytics/team')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'Per-member performance' })
  async getTeamMetrics(
    @Query('spaceId') spaceId: string,
    @Query('period') period: string,
  ) {
    return this.analytics.getTeamMetrics(spaceId, this.toPeriod(period));
  }

  @Get('analytics/approvals')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'Approval SLA metrics' })
  async getApprovalMetrics(
    @Query('spaceId') spaceId: string,
    @Query('period') period: string,
  ) {
    return this.analytics.getApprovalMetrics(spaceId, this.toPeriod(period));
  }

  @Get('analytics/ai')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'AI usage and cost estimation' })
  async getAiMetrics(
    @Query('spaceId') spaceId: string,
    @Query('period') period: string,
  ) {
    return this.analytics.getAiMetrics(spaceId, this.toPeriod(period));
  }

  @Get('analytics/export')
  @RequirePermissions(['read', 'analytics'])
  @ApiOperation({ summary: 'Export raw task data (CSV-able rows)' })
  async exportData(@Query('spaceId') spaceId: string) {
    return this.analytics.exportData(spaceId);
  }

  private toPeriod(period?: string) {
    const to = new Date();
    const from = new Date();
    switch (period) {
      case 'week':
        from.setDate(from.getDate() - 7);
        break;
      case 'month':
        from.setMonth(from.getMonth() - 1);
        break;
      case 'quarter':
        from.setMonth(from.getMonth() - 3);
        break;
      default:
        from.setMonth(from.getMonth() - 1);
    }
    return { from, to };
  }
}