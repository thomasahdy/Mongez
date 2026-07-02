import { Controller, Get, Post, Delete, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { TrashService } from './trash.service';

@ApiTags('Trash')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'List all soft-deleted items in a space' })
  async list(@Query('spaceId') spaceId: string) {
    return this.trashService.listTrash(spaceId);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted item' })
  async restore(@Req() req: any, @Param('id') id: string) {
    return this.trashService.restore(id, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently purge an item from trash' })
  async purge(@Req() req: any, @Param('id') id: string) {
    return this.trashService.purge(id, req.user.userId);
  }
}
