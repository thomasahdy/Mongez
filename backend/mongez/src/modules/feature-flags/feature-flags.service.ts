import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto/feature-flag.dto';
import { createHash } from 'crypto';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly CACHE_TTL_SECONDS = 60; // Cache config for 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async isEnabled(flag: string, context: { spaceId?: string; userId?: string }): Promise<boolean> {
    try {
      const cacheKey = `flag:${flag}`;
      let ff = await this.cache.get<any>(cacheKey);

      if (!ff) {
        ff = await this.prisma.featureFlag.findUnique({ where: { key: flag } });
        if (ff) {
          await this.cache.set(cacheKey, ff, this.CACHE_TTL_SECONDS);
        }
      }

      if (!ff) {
        return false;
      }

      if (!ff.isEnabled) {
        return false;
      }

      // Check targeted inclusions
      if (ff.enabledFor && ff.enabledFor.length > 0) {
        const isSpaceEnabled = context.spaceId && ff.enabledFor.includes(context.spaceId);
        const isUserEnabled = context.userId && ff.enabledFor.includes(context.userId);
        return !!(isSpaceEnabled || isUserEnabled);
      }

      // Check rollout bucket percent
      if (ff.rolloutPercent && ff.rolloutPercent > 0) {
        if (!context.userId) return false;
        // Deterministic hash based rollout
        const hash = createHash('md5').update(`${flag}:${context.userId}`).digest('hex');
        const bucket = parseInt(hash.slice(0, 8), 16) % 100;
        return bucket < ff.rolloutPercent;
      }

      return true; // Enabled globally
    } catch (err: any) {
      this.logger.error(`Error checking feature flag ${flag}: ${err.message}`);
      return false; // Fallback to safe disabled state on error
    }
  }

  // ─── CRUD Actions ─────────────────────────────────────────────────────────

  async create(dto: CreateFeatureFlagDto) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`Feature flag ${dto.key} already exists`);
    }

    const ff = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        description: dto.description,
        isEnabled: dto.isEnabled ?? false,
        enabledFor: dto.enabledFor ?? [],
        rolloutPercent: dto.rolloutPercent ?? 0,
      },
    });

    await this.cache.set(`flag:${dto.key}`, ff, this.CACHE_TTL_SECONDS);
    return ff;
  }

  async update(key: string, dto: UpdateFeatureFlagDto) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    const ff = await this.prisma.featureFlag.update({
      where: { key },
      data: {
        description: dto.description,
        isEnabled: dto.isEnabled,
        enabledFor: dto.enabledFor,
        rolloutPercent: dto.rolloutPercent,
      },
    });

    await this.cache.set(`flag:${key}`, ff, this.CACHE_TTL_SECONDS);
    return ff;
  }

  async delete(key: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    await this.prisma.featureFlag.delete({ where: { key } });
    await this.cache.del(`flag:${key}`);
  }

  async findAll() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findOne(key: string) {
    const ff = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!ff) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }
    return ff;
  }
}
