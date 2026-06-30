import { ConfigService } from '@nestjs/config';

export function canLogSensitiveAuthLinks(config: ConfigService): boolean {
  const env =
    config.get<string>('app.env') ||
    config.get<string>('NODE_ENV') ||
    process.env.NODE_ENV ||
    'development';

  return env === 'development' || env === 'test';
}
