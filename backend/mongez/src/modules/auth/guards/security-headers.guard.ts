import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { securityHeadersMiddleware } from '../../../common/security/http-security.config';

@Injectable()
export class SecurityHeadersGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const response = context.switchToHttp().getResponse();

    securityHeadersMiddleware(context.switchToHttp().getRequest(), response, () => undefined);

    return true;
  }
}
