import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ActivityLoggerInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const url = request.url;
    const method = request.method;

    return next.handle().pipe(
      tap(() => {
        if (!user) return;

        let action = '';
        let feature = '';
        const spaceId = request.params?.spaceId || request.body?.spaceId || request.query?.spaceId;

        if (url.includes('/tasks')) {
          feature = 'TASKS';
          if (method === 'POST') action = 'CREATE_TASK';
          else if (method === 'PATCH' || method === 'PUT') action = 'UPDATE_TASK';
        } else if (url.includes('/workflow')) {
          feature = 'WORKFLOW';
          if (url.includes('/decision') || url.includes('/submit')) action = 'SUBMIT_APPROVAL';
          else if (method === 'POST') action = 'START_WORKFLOW';
        } else if (url.includes('/meetings')) {
          feature = 'MEETINGS';
          if (method === 'POST') action = 'UPLOAD_MEETING';
        } else if (url.includes('/calendar')) {
          feature = 'CALENDAR';
          if (method === 'POST') action = 'CREATE_EVENT';
        }

        if (action && feature) {
          this.prisma.userActivity.create({
            data: {
              userId: user.id,
              action,
              feature,
              spaceId: spaceId ? String(spaceId) : null,
              metadata: {
                url,
                method,
              },
            },
          }).catch((err) => {
            console.error('Failed to log user activity:', err);
          });
        }
      }),
    );
  }
}
