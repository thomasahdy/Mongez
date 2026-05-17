import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';

/**
 * HTTP client that forwards requests to the Python FastAPI AI service.
 * All calls include the service API key for authentication.
 * Phase 1: Stubs only — actual forwarding implemented in Phase 2.
 */
@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('ai.serviceUrl') ?? 'http://localhost:8000';
    this.apiKey = this.configService.get<string>('ai.serviceApiKey') ?? 'dev-key';
  }

  private get headers() {
    return {
      'X-Service-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async chat(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    message: string;
    boardId?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding chat request to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(`${this.baseUrl}/chat`, payload, { headers: this.headers }),
    );
    return (response as AxiosResponse).data;
  }

  async analyzeRisk(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    boardId?: string;
    taskId?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding risk analysis to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(`${this.baseUrl}/risk/analyze`, payload, { headers: this.headers }),
    );
    return (response as AxiosResponse).data;
  }

  async generateReport(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    boardId?: string;
    reportType?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding report generation to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(`${this.baseUrl}/report/generate`, payload, { headers: this.headers }),
    );
    return (response as AxiosResponse).data;
  }

  getChatStreamUrl(traceId: string, spaceId: string, message: string): string {
    const params = new URLSearchParams({ traceId, spaceId, message });
    return `${this.baseUrl}/chat/stream?${params.toString()}`;
  }
}
