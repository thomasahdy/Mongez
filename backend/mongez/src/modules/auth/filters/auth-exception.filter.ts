import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message = typeof errorResponse === 'string' 
        ? errorResponse 
        : (errorResponse as any).message || message;
    }

    // In development, provide more detailed error information
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    const errorResponse = {
      success: false,
      message: isDevelopment ? message : 'An error occurred',
      statusCode: status,
    };

    if (isDevelopment) {
      (errorResponse as any).path = request.url;
      (errorResponse as any).method = request.method;
    }

    // In development, add stack trace and error details
    if (isDevelopment && exception instanceof Error) {
      (errorResponse as any).error = {
        name: exception.name,
        stack: exception.stack,
        details: exception,
      };
    }

    response
      .status(status)
      .json(errorResponse);
  }
}
