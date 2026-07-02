import { Controller, Get, Delete, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { DecisionsService } from './decisions.service';

@ApiTags('Decisions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Get decision ledger for a space' })
  async getDecisions(@Query('spaceId') spaceId: string) {
    return this.decisionsService.getDecisions(spaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a logged decision record' })
  async deleteDecision(@Param('id') id: string, @Req() req: any) {
    // Resource-by-id route: space is resolved from the record itself and
    // membership is verified inside the service (no spaceId in the request).
    return this.decisionsService.deleteDecision(id, req.user.userId);
  }
}
