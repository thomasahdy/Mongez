import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

/**
 * SpaceAccessService — service-level tenant-isolation helper.
 *
 * `SpaceMemberGuard` protects controller routes that carry a `spaceId` in the
 * request (params/body/query). Many routes instead operate on a resource by its
 * own id (e.g. `DELETE /workflow/instances/:id`) where the owning space is only
 * known after loading the resource. This service centralizes the membership /
 * role check for those cases so every module enforces isolation identically.
 *
 * It reuses the same `membership:{userId}:{spaceId}` cache key as the guard.
 */
@Injectable()
export class SpaceAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Assert that `userId` is a member of `spaceId`. If `requiredRoles` is
   * provided, also assert the member holds one of those space roles.
   * Returns the member's role name.
   *
   * @throws ForbiddenException when not a member or lacking the required role.
   */
  async assertMember(
    userId: string,
    spaceId: string | null | undefined,
    requiredRoles?: string[],
  ): Promise<string> {
    if (!userId || !spaceId) {
      throw new ForbiddenException('Space context is required for this request');
    }

    const cacheKey = `membership:${userId}:${spaceId}`;
    const membership = await this.cache.getOrSet<{ role: { name: string } } | null>(
      cacheKey,
      () =>
        this.prisma.membership.findFirst({
          where: { userId, spaceId },
          select: { role: { select: { name: true } } },
        }),
      300,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this space');
    }

    const roleName = membership.role.name;
    if (requiredRoles?.length && !requiredRoles.includes(roleName)) {
      throw new ForbiddenException(
        `This action requires space role: ${requiredRoles.join(' or ')}`,
      );
    }

    return roleName;
  }
}
