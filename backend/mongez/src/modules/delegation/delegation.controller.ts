import { Controller, Post, Get, Patch, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { DelegationService } from './delegation.service';
import { IsString, IsDateString } from 'class-validator';

export class CreateDelegationDto {
  @IsString()
  spaceId: string;

  @IsString()
  delegateId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

@ApiTags('Delegation')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('delegations')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Post()
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Delegate approval authority to another space member' })
  async create(@Req() req: any, @Body() dto: CreateDelegationDto) {
    const userId = req.user.id;
    return this.delegationService.createDelegation(
      userId,
      dto.spaceId,
      dto.delegateId,
      dto.startDate,
      dto.endDate,
    );
  }

  @Get()
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Get active/past delegations for a space' })
  async getDelegations(@Req() req: any, @Query('spaceId') spaceId: string) {
    const userId = req.user.id;
    return this.delegationService.getDelegations(userId, spaceId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate delegation' })
  async deactivate(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.delegationService.deactivateDelegation(id, userId);
  }
}
