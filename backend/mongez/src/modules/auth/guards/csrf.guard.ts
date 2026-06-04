import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { CsrfService } from '../services/csrf.service';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Skip CSRF validation for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Skip for requests that have Authorization header (they're already protected)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true;
    }

    // Validate CSRF token for POST, PUT, DELETE, PATCH
    const csrfToken = this.extractCsrfToken(request);
    const sessionId = this.csrfService.getSessionId(request);

    if (!csrfToken || !this.csrfService.validateToken(sessionId, csrfToken)) {
      throw new BadRequestException('Invalid or expired CSRF token');
    }

    return true;
  }

  /**
   * Extract CSRF token from request (header or cookie)
   */
  private extractCsrfToken(request: any): string | null {
    // Check header first
    const headerToken = request.headers['x-csrf-token'];
    if (headerToken) {
      return headerToken;
    }

    // Check cookie
    const cookieToken = request.cookies?.csrf_token;
    if (cookieToken) {
      return cookieToken;
    }

    // Check body
    const bodyToken = request.body?.csrf_token;
    if (bodyToken) {
      return bodyToken;
    }

    return null;
  }
}