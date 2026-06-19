import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { TraceContextService } from '../../infrastructure/logging/trace-context.service';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly traceContext: TraceContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const traceId =
      (req.headers['x-trace-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      uuid();
    req['traceId'] = traceId;
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Correlation-ID', traceId);
    
    this.traceContext.run(traceId, () => {
      next();
    });
  }
}
