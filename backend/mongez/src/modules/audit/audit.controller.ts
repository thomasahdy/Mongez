import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('spaces/:spaceId/audit-logs')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['read', 'audit'])
  @ApiOperation({ summary: 'List audit logs for a space (admin only)' })
  async listForSpace(
    @Query('spaceId') spaceId: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findBySpace(spaceId, {
      action,
      entityType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('audit-logs/me')
  @ApiOperation({ summary: "Current user's own activity" })
  async listMine(
    @Req() req: any,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findByUser(req.user.userId, {
      action,
      entityType,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}