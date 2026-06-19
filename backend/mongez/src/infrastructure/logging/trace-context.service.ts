import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TraceStore {
  traceId: string;
}

@Injectable()
export class TraceContextService {
  private readonly storage = new AsyncLocalStorage<TraceStore>();

  run<T>(traceId: string, fn: () => T): T {
    return this.storage.run({ traceId }, fn);
  }

  get traceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  get correlationId(): string | undefined {
    return this.traceId;
  }
}
