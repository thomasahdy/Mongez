import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * PermissionsGuard — enforces fine-grained permissions from the RolePermission table.
 *
 * Works in conjunction with @RequirePermissions(...) decorator.
 * Queries the permission set for the current user's role in the current space,
 * then checks that every required permission is granted.
 *
 * Usage:
 *   @Post('invite')
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @RequirePermissions('manage', 'member')
 *   async inviteMember(...) { ... }
 *
 * This guard reads the current spaceId from:
 *   1. Route param  → req.params.spaceId
 *   2. Request body → req.body.spaceId
 *   3. Query string → req.query.spaceId
 *
 * If no permissions are required (@RequirePermissions not applied), the guard
 * passes through automatically.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[][]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required — pass through
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Authentication required to access this resource.');
    }

    // Resolve spaceId from multiple possible locations
    const spaceId: string | undefined =
      request.params?.spaceId ??
      (request.params?.id && request.path.includes('/spaces/') ? request.params.id : undefined) ??
      request.body?.spaceId ??
      request.query?.spaceId ??
      request.taskSpaceId ??
      request.boardSpaceId;

    if (!spaceId) {
      // Can't check space permissions without a spaceId — deny by default
      throw new BadRequestException(
        'A spaceId is required to verify permissions for this action.',
      );
    }

    // Load the user's role + all granted permissions in this space
    const membership = await this.prisma.membership.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
      select: {
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                permission: {
                  select: { action: true, resource: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this space.');
    }

    // Build the set of granted permission strings in the format "action:resource"
    const granted = new Set(
      membership.role.permissions.map(
        (rp) => `${rp.permission.action}:${rp.permission.resource}`,
      ),
    );

    // OWNER always has all permissions — short-circuit
    if (membership.role.name === 'OWNER') return true;

    // Check every required permission
    const missing = required.filter(([action, resource]) => {
      return !granted.has(`${action}:${resource}`);
    });

    if (missing.length > 0) {
      const missingStr = missing.map(([a, r]) => `${a}:${r}`).join(', ');
      throw new ForbiddenException(
        `You do not have the required permissions: ${missingStr}`,
      );
    }

    return true;
  }
}
