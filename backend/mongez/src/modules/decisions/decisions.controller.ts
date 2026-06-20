import { Controller, Get, Delete, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DecisionsService } from './decisions.service';

@ApiTags('Decisions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get decision ledger for a space' })
  async getDecisions(@Query('spaceId') spaceId: string) {
    return this.decisionsService.getDecisions(spaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a logged decision record' })
  async deleteDecision(@Param('id') id: string) {
    return this.decisionsService.deleteDecision(id);
  }
}
