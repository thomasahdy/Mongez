import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  serviceApiKey: process.env.AI_SERVICE_API_KEY || 'dev-key',
  rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT || '30', 10),
}));
