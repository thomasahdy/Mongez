import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId: string = (request as any)['traceId'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      if (typeof res === 'string') {
        message = res;
      } else {
        // class-validator returns { message: string[] } — join it
        message = Array.isArray(res.message)
          ? res.message.join(', ')
          : res.message || message;
        details = res.details;
      }
      code = this.statusToCode(status);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          // Unique constraint violation
          const target = (exception.meta?.target as string[])?.join(', ');
          status = HttpStatus.CONFLICT;
          code = 'DUPLICATE_ENTRY';
          message = target
            ? `A record with this ${target} already exists`
            : 'A record with these values already exists';
          break;
        }
        case 'P2025':
          // Record not found (e.g. update/delete on missing row)
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'Record not found';
          break;
        case 'P2003':
          // Foreign key constraint failure
          status = HttpStatus.BAD_REQUEST;
          code = 'INVALID_REFERENCE';
          message = 'Referenced record does not exist';
          break;
        case 'P2014':
          // Required relation violation
          status = HttpStatus.BAD_REQUEST;
          code = 'RELATION_VIOLATION';
          message = 'The change you are trying to make would violate a required relation';
          break;
        default:
          this.logger.error(
            `Unhandled Prisma error [${exception.code}]`,
            exception.stack,
          );
      }
    } else {
      this.logger.error(
        'Unhandled exception',
        (exception as Error)?.stack,
        { traceId },
      );
    }

    if (status >= 500 || !(exception instanceof HttpException)) {
      Sentry.captureException(exception);
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
    };
    return map[status] || 'ERROR';
  }
}
