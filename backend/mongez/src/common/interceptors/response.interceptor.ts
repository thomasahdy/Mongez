import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T> | T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // If the controller already produced a standard response envelope
        // (i.e. it has a `success` boolean property), pass it through as-is
        // to avoid double-wrapping. Controllers like AuthController build
        // their own { success, data, message } objects explicitly.
        if (data !== null && typeof data === 'object' && 'success' in data) {
          return data;
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
