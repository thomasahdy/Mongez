import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { BoardAccessGuard } from '../boards/guards/board-access.guard';
import { ActivityService } from './activity.service';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('spaces/:spaceId/activity')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Get space-level activity feed' })
  async getSpaceActivity(
    @Param('spaceId') spaceId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.activityService.getSpaceActivity(spaceId, pagination.page, pagination.limit);
  }

  @Get('boards/:boardId/activity')
  @UseGuards(BoardAccessGuard)
  @ApiOperation({ summary: 'Get board-level activity feed' })
  async getBoardActivity(
    @Param('boardId') boardId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.activityService.getBoardActivity(boardId, pagination.page, pagination.limit);
  }
}
