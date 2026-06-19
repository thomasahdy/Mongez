import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * TenantMiddleware — resolves the current tenant (space) context for every request.
 *
 * Resolution order for spaceId:
 *   1. Route param  → /spaces/:spaceId/...
 *   2. Request body → { spaceId: "..." }
 *   3. Query string → ?spaceId=...
 *
 * When a spaceId is found AND the authenticated user is a member, this middleware
 * wraps the rest of the request in a TenantContextService.run() call, making
 * `tenant.spaceId`, `tenant.userId`, and `tenant.role` available everywhere in
 * the call stack without passing them explicitly.
 *
 * Non-tenant routes (public endpoints, /auth/*, /health) pass through untouched.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = (req as any).user?.userId;
    const spaceId =
      (req as any).params?.spaceId ??
      (req as any).body?.spaceId ??
      (req as any).query?.spaceId;

    // If we have both userId and spaceId, try to resolve membership
    if (userId && spaceId) {
      const membership = await this.prisma.membership.findUnique({
        where: { userId_spaceId: { userId, spaceId } },
        select: { role: { select: { name: true } } },
      });

      if (membership) {
        // Wrap the downstream handlers in the tenant context
        this.tenant.run(
          { spaceId, userId, role: membership.role.name },
          () => next(),
        );
        return;
      }
    }

    // No tenant context (public routes, auth routes, cross-space operations)
    next();
  }
}
