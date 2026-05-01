import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacesService } from './spaces.service';

@Controller('spaces')
@UseGuards(JwtAuthGuard)
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.spacesService.getById(id);
  }

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.spacesService.getAll(parseInt(page), parseInt(limit));
  }

  @Post()
  async create(@Body() body: any) {
    return this.spacesService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.spacesService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.spacesService.delete(id);
  }
}