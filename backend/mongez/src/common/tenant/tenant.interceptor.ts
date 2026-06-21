import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { resolveSpaceId } from '../utils/space-resolver';

/**
 * TenantInterceptor — wraps the downstream request execution (interceptor/controller/database)
 * inside the TenantContext (AsyncLocalStorage) context.
 *
 * It extracts:
 *   1. userId from req.user?.userId (set by JwtAuthGuard).
 *   2. spaceId and membershipRole resolved and attached by Guards (SpaceMemberGuard, BoardAccessGuard, TaskAccessGuard).
 *
 * If spaceId is not attached by any Guard (e.g. for endpoints that bypass space guards but carry a spaceId),
 * it falls back to extracting it from request body, query, or path params, and checks membership/role.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId;

    let spaceId = req.spaceId;
    let role = req.membershipRole;

    // Fallback lookup: if spaceId is not set by guards but exists in request, verify membership
    if (!spaceId && userId) {
      spaceId = resolveSpaceId(req);

      if (spaceId) {
        const membership = await this.prisma.membership.findUnique({
          where: { userId_spaceId: { userId, spaceId } },
          select: { role: { select: { name: true } } },
        });
        if (membership) {
          role = membership.role?.name ?? 'MEMBER';
          req.spaceId = spaceId;
          req.membershipRole = role;
        } else {
          spaceId = undefined; // not a member, clear context
        }
      }
    }

    if (userId && spaceId) {
      // Wrap the rest of the request lifecycle in the tenant context
      return new Observable((subscriber) => {
        this.tenant.run(
          { spaceId, userId, role: role || 'MEMBER' },
          () => {
            const subscription = next.handle().subscribe(subscriber);
            return () => subscription.unsubscribe();
          },
        );
      });
    }

    return next.handle();
  }
}
