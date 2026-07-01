import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const serviceApiKey = process.env.AI_SERVICE_API_KEY;

  if (isProduction) {
    if (!serviceApiKey || serviceApiKey === 'dev-key') {
      throw new Error('AI_SERVICE_API_KEY must be configured in production and cannot be the default "dev-key".');
    }
  }

  return {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    serviceApiKey: serviceApiKey || 'dev-key',
    rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT || '30', 10),
  };
});
