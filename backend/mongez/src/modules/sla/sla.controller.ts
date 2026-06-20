import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SlaService } from './sla.service';

@ApiTags('SLA')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('compliance')
  @ApiOperation({ summary: 'Get approval workflow SLA compliance rate' })
  async getCompliance(@Query('spaceId') spaceId: string) {
    return this.slaService.getSlaCompliance(spaceId);
  }
}
