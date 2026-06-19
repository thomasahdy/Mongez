import { AIClientService } from '../ai-client.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TraceContextService } from '../../../infrastructure/logging/trace-context.service';
import { of } from 'rxjs';

describe('AIClientService', () => {
  let service: AIClientService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let traceContext: jest.Mocked<TraceContextService>;

  const basePayload = {
    traceId: 'trace-test',
    userId: 'user-1',
    spaceId: 'space-1',
    message: 'What is the status?',
  };

  beforeEach(() => {
    httpService = {
      post: jest.fn(),
    } as any;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ai.serviceUrl') return 'http://ai-service:8000';
        if (key === 'ai.serviceApiKey') return 'test-api-key';
        if (key === 'ai.timeoutMs') return 5000;
        return undefined;
      }),
    } as any;

    traceContext = {
      traceId: 'trace-test',
    } as any;

    service = new AIClientService(httpService, configService, traceContext);
  });

  // ─── chat ────────────────────────────────────────────────────

  describe('chat()', () => {
    it('UT-AI-CLIENT-001: should POST to /chat endpoint with correct payload and headers', async () => {
      const mockResponse = { data: { response: 'OK', traceId: 'trace-1' } };
      httpService.post.mockReturnValue(of(mockResponse) as any);

      const result = await service.chat(basePayload);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-service:8000/chat',
        expect.objectContaining({
          message: basePayload.message,
          space_id: basePayload.spaceId,
          user_id: basePayload.userId,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Service-API-Key': 'test-api-key' }),
          timeout: 5000,
        }),
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('UT-AI-CLIENT-002: should include X-Trace-Id header when traceId is set', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.chat(basePayload);

      const callArgs = (httpService.post as jest.Mock).mock.calls[0][2];
      expect(callArgs.headers['X-Trace-Id']).toBe('trace-test');
    });

    it('should use default field values when optional fields are not provided', async () => {
      httpService.post.mockReturnValue(of({ data: {} }) as any);

      await service.chat({ traceId: 'trace-1', userId: 'u-1', spaceId: 's-1', message: 'Hi' });

      const body = (httpService.post as jest.Mock).mock.calls[0][1];
      expect(body.user_name).toBe('User');
      expect(body.user_role).toBe('Member');
      expect(body.space_name).toBe('My Space');
      expect(body.board_name).toBe('All Boards');
    });
  });

  // ─── analyzeRisk ─────────────────────────────────────────────

  describe('analyzeRisk()', () => {
    it('UT-AI-CLIENT-003: should POST to /risk endpoint with correct payload', async () => {
      const mockData = { risks: [] };
      httpService.post.mockReturnValue(of({ data: mockData }) as any);

      const result = await service.analyzeRisk({
        traceId: 'trace-2',
        userId: 'user-1',
        spaceId: 'space-1',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-service:8000/risk',
        expect.objectContaining({ space_id: 'space-1' }),
        expect.any(Object),
      );
      expect(result).toEqual(mockData);
    });
  });

  // ─── generateReport ──────────────────────────────────────────

  describe('generateReport()', () => {
    it('should POST to /report endpoint', async () => {
      const mockReport = { report: '# Summary' };
      httpService.post.mockReturnValue(of({ data: mockReport }) as any);

      const result = await service.generateReport({
        traceId: 'trace-3',
        userId: 'user-1',
        spaceId: 'space-1',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-service:8000/report',
        expect.objectContaining({ space_id: 'space-1' }),
        expect.any(Object),
      );
      expect(result).toEqual(mockReport);
    });
  });

  // ─── indexDocument ───────────────────────────────────────────

  describe('indexDocument()', () => {
    it('UT-AI-CLIENT-004: should POST to /index endpoint with spaceId and taskId', async () => {
      httpService.post.mockReturnValue(of({ data: { indexed: true } }) as any);

      const result = await service.indexDocument({ spaceId: 'space-1', taskId: 'task-1' });

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-service:8000/index',
        { space_id: 'space-1', task_id: 'task-1' },
        expect.any(Object),
      );
      expect(result).toEqual({ indexed: true });
    });
  });

  // ─── retrieveContext ─────────────────────────────────────────

  describe('retrieveContext()', () => {
    it('should POST to /retrieve endpoint and return context', async () => {
      httpService.post.mockReturnValue(of({ data: { context: 'Task details...' } }) as any);

      const result = await service.retrieveContext({ spaceId: 'space-1', query: 'blocked tasks' });

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-service:8000/retrieve',
        { space_id: 'space-1', query: 'blocked tasks' },
        expect.any(Object),
      );
      expect(result).toEqual({ context: 'Task details...' });
    });
  });

  // ─── config defaults ─────────────────────────────────────────

  describe('constructor defaults', () => {
    it('UT-AI-CLIENT-005: should use fallback values when config is not set', () => {
      const emptyConfig: jest.Mocked<ConfigService> = {
        get: jest.fn().mockReturnValue(undefined),
      } as any;

      const fallbackService = new AIClientService(httpService, emptyConfig, traceContext);

      // Access private field through any cast
      expect((fallbackService as any).baseUrl).toBe('http://localhost:8000');
      expect((fallbackService as any).apiKey).toBe('dev-key');
      expect((fallbackService as any).timeoutMs).toBe(30000);
    });
  });
});
