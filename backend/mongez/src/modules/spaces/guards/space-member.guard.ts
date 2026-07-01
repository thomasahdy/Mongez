import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { resolveSpaceId } from '../../../common/utils/space-resolver';

export const SPACE_ROLES_KEY = 'spaceRoles';
export const SpaceRoles = (...roles: string[]) => SetMetadata(SPACE_ROLES_KEY, roles);

/**
 * SpaceMemberGuard — the primary tenant-isolation guard.
 *
 * Reads spaceId using resolveSpaceId helper (checks params, body, query).
 *
 * Attaches req.membershipRole for downstream use.
 * Optionally enforces a required space role via @SpaceRoles('OWNER', 'ADMIN').
 */
@Injectable()
export class SpaceMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.userId;
    if (!userId) return false;

    let spaceId = resolveSpaceId(req);
    if (!spaceId && req.body?.boardId) {
      const board = await this.prisma.board.findUnique({
        where: { id: req.body.boardId },
        select: { department: { select: { spaceId: true } } },
      });
      spaceId = board?.department?.spaceId;
      req.boardSpaceId = spaceId;
    }

    if (!spaceId) {
      throw new ForbiddenException('Space context (spaceId) is required for this request');
    }

    const cacheKey = `membership:${userId}:${spaceId}`;
    const membership = await this.cache.getOrSet<{ role: { name: string } } | null>(
      cacheKey,
      () => this.prisma.membership.findFirst({
        where: { userId, spaceId },
        select: { role: { select: { name: true } } },
      }),
      300, // 5 minutes TTL
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this space');
    }

    req.spaceId = spaceId;
    req.membershipRole = membership.role.name;

    const requiredRoles = this.reflector.get<string[]>(SPACE_ROLES_KEY, context.getHandler());
    if (requiredRoles?.length && !requiredRoles.includes(membership.role.name)) {
      throw new ForbiddenException(`This action requires space role: ${requiredRoles.join(' or ')}`);
    }

    return true;
  }
}
