import './infrastructure/observability/otel.setup';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './common/swagger/swagger.setup';
import { RedisIoAdapter } from './infrastructure/redis/redis-io.adapter';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { ValidationPipe } from '@nestjs/common';
import { JsonLoggerService } from './infrastructure/logging/json-logger.service';
import { TraceContextService } from './infrastructure/logging/trace-context.service';

async function bootstrap() {
  const traceContext = new TraceContextService();
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLoggerService(traceContext),
    // Store the raw request body so webhook signature verification
    // (Meta `X-Hub-Signature-256`) can HMAC the exact bytes received.
    rawBody: true,
  });

  // ── API versioning ─────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Redis WebSocket Adapter ────────────────────────────────
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // ── Middleware ─────────────────────────────────────────────
  // (TraceMiddleware + TenantMiddleware registered in AppModule.configure())
  app.use(cookieParser());

  // ── CORS ───────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // ── Global exception filter (Prisma error mapping) ─────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global response envelope ───────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── Global pipes ───────────────────────────────────────────
  // 1. ValidationPipe — strips unknown fields, transforms types
  // 2. SanitizePipe   — removes XSS/null bytes from string values
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
    new SanitizePipe(),
  );

  // ── Swagger (dev only) ─────────────────────────────────────
  const isWorker = process.env.APP_MODE === 'worker';
  if (!isWorker) {
    setupSwagger(app);
  }

  const port = isWorker ? (process.env.WORKER_PORT ?? 3001) : (process.env.PORT ?? 3000);
  await app.listen(port);
  
  if (isWorker) {
    console.log(`🚀 Worker running on: http://localhost:${port}`);
  } else {
    console.log(`🌐 API running on: http://localhost:${port}/api/v1`);
    console.log(`📄 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();

