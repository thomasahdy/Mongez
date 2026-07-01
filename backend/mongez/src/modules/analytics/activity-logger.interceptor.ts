import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../infrastructure/queue/queue.constants';

@Injectable()
export class ActivityLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggerInterceptor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.ACTIVITY_LOG) private readonly activityQueue: Queue,
  ) {}

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
          this.activityQueue.add(
            JOB_NAMES.LOG_USER_ACTIVITY,
            {
              userId: user.id,
              action,
              feature,
              spaceId: spaceId ? String(spaceId) : null,
              metadata: { url, method },
            },
            { removeOnComplete: 500 }
          ).catch((err) => {
            this.logger.error(`Failed to enqueue user activity log: ${err.message}`);
          });
        }
      }),
    );
  }
}
