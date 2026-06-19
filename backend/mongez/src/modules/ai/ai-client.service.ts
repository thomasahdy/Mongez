import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { randomUUID } from 'crypto';
import type { AxiosResponse } from 'axios';
import { TraceContextService } from '../../infrastructure/logging/trace-context.service';

/**
 * HTTP client that forwards requests to the Python FastAPI AI service.
 * All calls include the service API key for authentication.
 */
@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly traceContext: TraceContextService,
  ) {
    this.baseUrl = this.configService.get<string>('ai.serviceUrl') ?? 'http://localhost:8000';
    this.apiKey = this.configService.get<string>('ai.serviceApiKey') ?? 'dev-key';
    this.timeoutMs = this.configService.get<number>('ai.timeoutMs') ?? 30000;
  }

  private get headers() {
    const traceId = this.traceContext.traceId;
    return {
      'X-Service-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...(traceId ? { 'X-Trace-Id': traceId, 'X-Request-Id': traceId } : {}),
    };
  }

  // ─── Chat (blocking) ────────────────────────────────────────────────────────

  async chat(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    message: string;
    userName?: string;
    userRole?: string;
    spaceName?: string;
    boardName?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding chat request to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(
        `${this.baseUrl}/chat`,
        {
          message: payload.message,
          space_id: payload.spaceId,
          user_id: payload.userId,
          user_name: payload.userName ?? 'User',
          user_role: payload.userRole ?? 'Member',
          space_name: payload.spaceName ?? 'My Space',
          board_name: payload.boardName ?? 'All Boards',
          trace_id: payload.traceId,
        },
        { headers: this.headers, timeout: this.timeoutMs },
      ),
    );
    return (response as AxiosResponse).data;
  }

  // ─── Chat (SSE streaming) ──────────────────────────────────────────────────

  /**
   * Stream chat response tokens via SSE.
   * Returns an Observable that emits individual SSE data lines (JSON strings).
   * Uses native fetch because axios doesn't support streaming response bodies well.
   */
  streamChat(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    message: string;
    userName?: string;
    userRole?: string;
    spaceName?: string;
    boardName?: string;
  }): Observable<string> {
    const subject = new Subject<string>();
    const url = `${this.baseUrl}/chat/stream`;

    const body = JSON.stringify({
      message: payload.message,
      space_id: payload.spaceId,
      user_id: payload.userId,
      user_name: payload.userName ?? 'User',
      user_role: payload.userRole ?? 'Member',
      space_name: payload.spaceName ?? 'My Space',
      board_name: payload.boardName ?? 'All Boards',
      trace_id: payload.traceId,
    });

    this.logger.log(`[${payload.traceId}] Opening SSE stream to AI service`);

    fetch(url, {
      method: 'POST',
      headers: this.headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs * 2), // Streams get longer timeout
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          subject.error(new Error(`AI service returned ${response.status}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse complete SSE data lines from the buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6); // Remove "data: "
              subject.next(jsonStr);
            }
          }
        }

        // Process any remaining buffered data
        if (buffer.trim().startsWith('data: ')) {
          subject.next(buffer.trim().slice(6));
        }

        subject.complete();
      })
      .catch((err) => {
        this.logger.error(`[${payload.traceId}] SSE stream error: ${err.message}`);
        subject.error(err);
      });

    return subject.asObservable();
  }

  // ─── Risk Analysis ──────────────────────────────────────────────────────────

  async analyzeRisk(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    userName?: string;
    userRole?: string;
    spaceName?: string;
    boardName?: string;
    query?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding risk analysis to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(
        `${this.baseUrl}/risk`,
        {
          space_id: payload.spaceId,
          user_id: payload.userId,
          user_name: payload.userName ?? 'User',
          user_role: payload.userRole ?? 'Member',
          space_name: payload.spaceName ?? 'My Space',
          board_name: payload.boardName ?? 'All Boards',
          query: payload.query ?? 'Analyse all risks in this project',
          trace_id: payload.traceId,
        },
        { headers: this.headers, timeout: this.timeoutMs },
      ),
    );
    return (response as AxiosResponse).data;
  }

  // ─── Report Generation ─────────────────────────────────────────────────────

  async generateReport(payload: {
    traceId: string;
    userId: string;
    spaceId: string;
    userName?: string;
    userRole?: string;
    spaceName?: string;
    boardName?: string;
    query?: string;
  }) {
    this.logger.log(`[${payload.traceId}] Forwarding report generation to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(
        `${this.baseUrl}/report`,
        {
          space_id: payload.spaceId,
          user_id: payload.userId,
          user_name: payload.userName ?? 'User',
          user_role: payload.userRole ?? 'Member',
          space_name: payload.spaceName ?? 'My Space',
          board_name: payload.boardName ?? 'All Boards',
          query: payload.query ?? 'Generate a project status report',
          trace_id: payload.traceId,
        },
        { headers: this.headers, timeout: this.timeoutMs },
      ),
    );
    return (response as AxiosResponse).data;
  }

  // ─── RAG / Indexing ────────────────────────────────────────────────────────

  async indexDocument(payload: { spaceId: string; taskId: string }) {
    this.logger.log(`Forwarding index document request for taskId ${payload.taskId} to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<Record<string, unknown>>(
        `${this.baseUrl}/index`,
        {
          space_id: payload.spaceId,
          task_id: payload.taskId,
        },
        { headers: this.headers, timeout: this.timeoutMs },
      ),
    );
    return (response as AxiosResponse).data;
  }

  async retrieveContext(payload: { spaceId: string; query: string }) {
    this.logger.log(`Forwarding retrieve context request for query "${payload.query}" to AI service`);
    const response = await firstValueFrom(
      this.httpService.post<{ context: string }>(
        `${this.baseUrl}/retrieve`,
        {
          space_id: payload.spaceId,
          query: payload.query,
        },
        { headers: this.headers, timeout: this.timeoutMs },
      ),
    );
    return (response as AxiosResponse).data;
  }
}
