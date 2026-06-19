import { SetMetadata } from '@nestjs/common';

export interface AuditLogOptions {
  action: string;
  entityType: string;
  entityIdParam?: string; // param key in route to extract entityId, e.g. 'id'
}

export const AUDIT_LOG_KEY = 'audit_log_metadata';

/**
 * Decorator to enable audit logging on a controller route.
 * Managed by the AuditLogInterceptor.
 */
export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_KEY, options);
