import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV === 'production') return; // Never expose docs in prod

  const config = new DocumentBuilder()
    .setTitle('Mongez API')
    .setDescription(
      'AI-powered project management platform API. ' +
      'All endpoints are prefixed with /api/v1.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,   // keeps token between page refreshes
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
