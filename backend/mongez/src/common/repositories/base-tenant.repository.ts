import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * BaseTenantRepository — base class for all tenant-scoped repositories.
 *
 * Automatically injects the current tenant's spaceId into every query via
 * the `scoped()` helper. Developers should extend this class for any repository
 * that handles data belonging to a specific space (tasks, boards, notifications, etc.).
 *
 * Usage:
 *   class TaskRepository extends BaseTenantRepository {
 *     async findByBoard(boardId: string) {
 *       return this.prisma.task.findMany(
 *         this.scoped({ where: { boardId } })  // ← spaceId injected automatically
 *       );
 *     }
 *   }
 *
 * IMPORTANT: Only extend this class for queries that should be tenant-scoped.
 * Global queries (e.g., looking up a user by email) should use PrismaService directly.
 */
export abstract class BaseTenantRepository {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly tenant: TenantContextService,
  ) {}

  /**
   * Returns the spaceId of the current tenant, or undefined if no context is active.
   * Use `safeSpaceId` when the tenant context may not be set (e.g. background jobs).
   */
  protected get safeSpaceId(): string | undefined {
    return this.tenant.getStore()?.spaceId;
  }

  /**
   * Returns the spaceId of the current tenant.
   * Throws if called outside a tenant context.
   */
  protected get spaceId(): string {
    return this.tenant.spaceId;
  }

  /**
   * Returns a Prisma query object with `{ spaceId }` automatically merged
   * into the `where` clause. Falls back to an empty merge if no context is active
   * (background jobs, seeder scripts) so queries don't break.
   *
   * @example
   * // Instead of:
   * this.prisma.task.findMany({ where: { boardId, spaceId: 'hardcoded' } })
   *
   * // Use:
   * this.prisma.task.findMany(this.scoped({ where: { boardId } }))
   */
  protected scoped<T extends { where?: Record<string, unknown> }>(query: T): T {
    const spaceId = this.safeSpaceId;
    if (!spaceId) return query;

    return {
      ...query,
      where: {
        ...query.where,
        spaceId,
      },
    };
  }

  /**
   * A filter object to append to any Prisma `where` clause that requires spaceId
   * through a relation (e.g., task.board.department.spaceId).
   *
   * @example
   * this.prisma.task.findMany({
   *   where: {
   *     boardId,
   *     board: { department: this.tenantRelationFilter }
   *   }
   * })
   */
  protected get tenantRelationFilter() {
    const spaceId = this.safeSpaceId;
    return spaceId ? { spaceId } : {};
  }
}
