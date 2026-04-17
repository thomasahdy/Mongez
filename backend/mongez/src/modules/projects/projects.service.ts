import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectsService {
  private readonly CACHE_PREFIX = 'project';
  private readonly CACHE_TTL = 180;

  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly cache: CacheService,
  ) {}

  async getById(id: string) {
    return this.cache.getOrSet(`${this.CACHE_PREFIX}:${id}`, async () => {
      const project = await this.projectRepo.findById(id);
      if (!project) throw new NotFoundException('Project not found');
      return project;
    }, this.CACHE_TTL);
  }

  async getAll(page?: number, limit?: number) {
    return this.projectRepo.findAll(page, limit);
  }

  async create(data: any) {
    const project = await this.projectRepo.create(data);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return project;
  }

  async update(id: string, data: any) {
    const project = await this.projectRepo.update(id, data);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return project;
  }

  async delete(id: string) {
    await this.projectRepo.delete(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }
}