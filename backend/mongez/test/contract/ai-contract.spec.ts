import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AIClientService } from '../../src/modules/ai/ai-client.service';
import { TraceContextService } from '../../src/infrastructure/logging/trace-context.service';
import http from 'http';

describe('AI Service Contract (Contract)', () => {
  let clientService: AIClientService;
  let server: http.Server;
  let receivedRequests: Array<{ url: string; method: string; body: any; headers: any }> = [];

  beforeAll(async () => {
    // 1. Start mock server on port 8001
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        receivedRequests.push({
          url: req.url || '',
          method: req.method || '',
          body: data ? JSON.parse(data) : {},
          headers: req.headers,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, response: 'contract-ok', trace_id: 't-123' }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(8001, () => resolve());
    });

    // Mock environment for ConfigService to pick up port 8001
    process.env.AI_SERVICE_URL = 'http://localhost:8001';
    process.env.AI_SERVICE_API_KEY = 'contract-key';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              ai: {
                serviceUrl: 'http://localhost:8001',
                serviceApiKey: 'contract-key',
              },
            }),
          ],
        }),
      ],
      providers: [AIClientService, TraceContextService],
    }).compile();

    clientService = moduleRef.get(AIClientService);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    receivedRequests = [];
  });

  it('CT-CTR-008: should match chat endpoint contract (field translation, auth key)', async () => {
    await clientService.chat({
      traceId: 'trace-chat-123',
      userId: 'user-1',
      spaceId: 'space-1',
      message: 'Hello AI',
    });

    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];
    
    // Verify path
    expect(req.url).toBe('/chat');
    expect(req.method).toBe('POST');
    
    // Verify headers
    expect(req.headers['x-service-api-key']).toBe('contract-key');

    // Verify snake_case field mappings (Python API expects snake_case)
    expect(req.body.message).toBe('Hello AI');
    expect(req.body.space_id).toBe('space-1');
    expect(req.body.user_id).toBe('user-1');
    expect(req.body.trace_id).toBe('trace-chat-123');
  });

  it('should match risk endpoint contract (field translation, auth key)', async () => {
    await clientService.analyzeRisk({
      traceId: 'trace-risk-456',
      userId: 'user-2',
      spaceId: 'space-2',
      query: 'Check risks',
    });

    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    expect(req.url).toBe('/risk');
    expect(req.method).toBe('POST');
    expect(req.headers['x-service-api-key']).toBe('contract-key');

    expect(req.body.space_id).toBe('space-2');
    expect(req.body.user_id).toBe('user-2');
    expect(req.body.query).toBe('Check risks');
    expect(req.body.trace_id).toBe('trace-risk-456');
  });

  it('should match report endpoint contract (field translation, auth key)', async () => {
    await clientService.generateReport({
      traceId: 'trace-report-789',
      userId: 'user-3',
      spaceId: 'space-3',
    });

    expect(receivedRequests.length).toBe(1);
    const req = receivedRequests[0];

    expect(req.url).toBe('/report');
    expect(req.method).toBe('POST');
    expect(req.headers['x-service-api-key']).toBe('contract-key');

    expect(req.body.space_id).toBe('space-3');
    expect(req.body.user_id).toBe('user-3');
    expect(req.body.trace_id).toBe('trace-report-789');
  });
});
