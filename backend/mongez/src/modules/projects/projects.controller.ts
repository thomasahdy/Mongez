import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.projectsService.getById(id);
  }

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.projectsService.getAll(parseInt(page), parseInt(limit));
  }

  @Post()
  async create(@Body() body: any) {
    return this.projectsService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}