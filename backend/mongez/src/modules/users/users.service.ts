import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UserRepository } from './user.repository';

@Injectable()
export class UsersService {
  private readonly CACHE_PREFIX = 'user';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CacheService,
  ) {}

  async getProfile(userId: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${userId}`,
      () => {
        const user = this.userRepo.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        return user;
      },
      this.CACHE_TTL,
    );
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    const user = await this.userRepo.updateProfile(userId, data);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, userId);
    return user;
  }

  async getUsersByIds(ids: string[]) {
    return this.userRepo.findByIds(ids);
  }
}