import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

/**
 * Configures a NestJS test application with the same global middleware,
 * interceptors, pipes and filters that main.ts applies to the production app.
 *
 * This ensures integration test responses match the real API shape
 * (e.g. `{ success, data }` envelope from ResponseInterceptor).
 */
export async function createTestApp(
  moduleFixture: TestingModule,
  options: { prefix?: string } = {},
): Promise<INestApplication> {
  const app = moduleFixture.createNestApplication();

  // Match main.ts setup -------------------------------------------------

  // Cookie parsing (needed for cookie-based JWT auth)
  app.use(cookieParser());

  // API prefix
  app.setGlobalPrefix(options.prefix ?? 'api/v1');

  // Global exception filter (Prisma error mapping + structured errors)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global response envelope: wraps every response in { success, data, timestamp }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ---------------------------------------------------------------------

  await app.init();
  return app;
}
