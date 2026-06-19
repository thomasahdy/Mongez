import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  spaceId: string;
  userId: string;
  role: string;
}

/**
 * TenantContextService — carries tenant information across the async call stack.
 *
 * Uses Node's AsyncLocalStorage so the current spaceId/userId/role is accessible
 * anywhere in the request lifecycle without passing it as a parameter.
 *
 * Usage:
 *   // In a repository (via BaseTenantRepository):
 *   const spaceId = this.tenant.spaceId; // always the current request's tenant
 *
 * The TenantMiddleware populates this context on every request that carries
 * a spaceId in params, body, or query. Routes without a spaceId (public endpoints,
 * auth) pass through without initialisation.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Run `fn` within a tenant context. Called by TenantMiddleware.
   */
  run<T>(store: TenantStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  /**
   * The spaceId of the current tenant. Throws if called outside a tenant context.
   */
  get spaceId(): string {
    const store = this.storage.getStore();
    if (!store?.spaceId) {
      throw new Error(
        'TenantContext not initialised for this request. ' +
          'Ensure TenantMiddleware is active and the request carries a spaceId.',
      );
    }
    return store.spaceId;
  }

  /** The userId of the authenticated user making the request. */
  get userId(): string {
    return this.storage.getStore()?.userId ?? '';
  }

  /** The space-level role of the authenticated user (e.g. 'OWNER', 'ADMIN', 'MEMBER'). */
  get role(): string {
    return this.storage.getStore()?.role ?? 'MEMBER';
  }

  /** Returns the full store, or undefined if no context is active. */
  getStore(): TenantStore | undefined {
    return this.storage.getStore();
  }

  /** Returns true if a tenant context is currently active. */
  get isActive(): boolean {
    return !!this.storage.getStore();
  }
}
