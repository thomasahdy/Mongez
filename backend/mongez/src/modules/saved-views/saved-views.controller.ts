import { Controller, Post, Get, Delete, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavedViewsService } from './saved-views.service';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateSavedViewDto {
  @IsString()
  spaceId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  filters: any;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@ApiTags('SavedViews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly savedViewsService: SavedViewsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a custom filtered board view configuration' })
  async create(@Req() req: any, @Body() dto: CreateSavedViewDto) {
    const userId = req.user.id;
    return this.savedViewsService.createView(
      userId,
      dto.spaceId,
      dto.name,
      dto.icon || null,
      dto.filters,
      dto.isPublic || false,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get saved board views for a space' })
  async getViews(@Req() req: any, @Query('spaceId') spaceId: string) {
    const userId = req.user.id;
    return this.savedViewsService.getViews(userId, spaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved view' })
  async delete(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.savedViewsService.deleteView(id, userId);
  }
}
