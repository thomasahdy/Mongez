import { ConsoleLogger, Injectable, Inject, Optional } from '@nestjs/common';
import { TraceContextService } from './trace-context.service';

@Injectable()
export class JsonLoggerService extends ConsoleLogger {
  constructor(
    @Optional()
    private readonly traceContext?: TraceContextService,
  ) {
    super();
  }

  private printJson(level: string, message: any, context?: string, trace?: string) {
    const traceId = this.traceContext?.traceId;
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      context: context || this.context || 'Nest',
      message: typeof message === 'object' ? message : String(message),
      ...(traceId ? { traceId } : {}),
      ...(trace ? { trace } : {}),
    };
    process.stdout.write(JSON.stringify(logData) + '\n');
  }

  log(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('info', message, context);
    } else {
      super.log(message, context || this.context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('error', message, context, trace);
    } else {
      super.error(message, trace, context || this.context);
    }
  }

  warn(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('warn', message, context);
    } else {
      super.warn(message, context || this.context);
    }
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('debug', message, context);
    } else {
      super.debug(message, context || this.context);
    }
  }

  verbose(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      this.printJson('verbose', message, context);
    } else {
      super.verbose(message, context || this.context);
    }
  }
}
