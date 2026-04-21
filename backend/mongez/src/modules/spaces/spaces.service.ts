import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { SpaceRepository } from './space.repository';

@Injectable()
export class SpacesService {
  private readonly CACHE_PREFIX = 'space';
  private readonly CACHE_TTL = 180;

  constructor(
    private readonly spaceRepo: SpaceRepository,
    private readonly cache: CacheService,
  ) {}

  async getById(id: string) {
    return this.cache.getOrSet(`${this.CACHE_PREFIX}:${id}`, async () => {
      const space = await this.spaceRepo.findById(id);
      if (!space) throw new NotFoundException('Space not found');
      return space;
    }, this.CACHE_TTL);
  }

  async getAll(page?: number, limit?: number) {
    return this.spaceRepo.findAll(page, limit);
  }

  async create(data: any) {
    const space = await this.spaceRepo.create(data);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return space;
  }

  async update(id: string, data: any) {
    const space = await this.spaceRepo.update(id, data);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return space;
  }

  async delete(id: string) {
    await this.spaceRepo.delete(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }
}