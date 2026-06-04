import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for internal service-to-service routes.
 * Validates the X-Service-API-Key header against the configured secret.
 * These routes are NOT protected by user JWT — they are called by the Python AI service.
 */
@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-service-api-key'];
    const expectedKey = this.configService.get<string>('ai.serviceApiKey');

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing service API key');
    }
    return true;
  }
}
