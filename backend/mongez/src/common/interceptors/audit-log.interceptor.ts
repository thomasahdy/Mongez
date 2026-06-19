import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.getAllAndOverride<AuditLogOptions>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userId = user?.userId;

    if (!userId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => {
          try {
            const paramKey = options.entityIdParam || 'id';
            const entityId =
              request.params?.[paramKey] ??
              response?.id ??
              request.body?.[paramKey] ??
              'unknown';

            // Resolve IP address safely
            const ipAddress =
              request.ip ||
              request.headers['x-forwarded-for'] ||
              request.connection?.remoteAddress ||
              null;

            // Log parameters and request payload details
            const diff = {
              body: request.body,
              query: request.query,
              responseStatus: 'success',
            };

            if (this.auditService) {
              this.auditService.log({
                userId,
                action: options.action,
                entityType: options.entityType,
                entityId,
                diff,
                ipAddress,
              });
            }
          } catch (err) {
            console.error('AuditLogInterceptor failed to queue log:', err);
          }
        },
      }),
    );
  }
}
