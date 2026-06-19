import { Test, TestingModule } from '@nestjs/testing';
import { TraceContextService } from './trace-context.service';
import { JsonLoggerService } from './json-logger.service';

describe('Logging Infrastructure', () => {
  describe('TraceContextService', () => {
    let service: TraceContextService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [TraceContextService],
      }).compile();

      service = module.get<TraceContextService>(TraceContextService);
    });

    it('should set and retrieve traceId in async storage context', () => {
      expect(service.traceId).toBeUndefined();

      service.run('trace-123', () => {
        expect(service.traceId).toBe('trace-123');
      });

      expect(service.traceId).toBeUndefined();
    });
  });

  describe('JsonLoggerService', () => {
    let logger: JsonLoggerService;
    let traceContext: TraceContextService;
    let writeSpy: jest.SpyInstance;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TraceContextService,
          JsonLoggerService,
        ],
      }).compile();

      traceContext = module.get<TraceContextService>(TraceContextService);
      logger = module.get<JsonLoggerService>(JsonLoggerService);
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('should output structured JSON in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logger.log('hello world', 'MyContext');

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(writeSpy.mock.calls[0][0].trim());
      expect(output.level).toBe('info');
      expect(output.message).toBe('hello world');
      expect(output.context).toBe('MyContext');
      expect(output.timestamp).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should inject traceId in JSON log if present in trace context', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      traceContext.run('trace-abc', () => {
        logger.log('some message');
      });

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(writeSpy.mock.calls[0][0].trim());
      expect(output.traceId).toBe('trace-abc');
      expect(output.message).toBe('some message');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
