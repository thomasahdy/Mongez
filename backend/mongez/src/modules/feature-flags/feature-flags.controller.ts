import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
export class FeatureFlagsController {
  constructor(private readonly flagsService: FeatureFlagsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFeatureFlagDto) {
    return this.flagsService.create(dto);
  }

  @Patch(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.flagsService.update(key, dto);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('key') key: string) {
    await this.flagsService.delete(key);
  }

  @Get()
  async findAll() {
    return this.flagsService.findAll();
  }

  @Get('eval/:key')
  async evaluate(
    @Param('key') key: string,
    @Query('spaceId') spaceId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    const enabled = await this.flagsService.isEnabled(key, { spaceId, userId });
    return { key, enabled };
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return this.flagsService.findOne(key);
  }
}
