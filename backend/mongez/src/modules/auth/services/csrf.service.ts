import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CsrfService {
  private readonly secret: string;
  private readonly tokenExpiry: number;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('auth.csrf.secret') || this.generateSecret();
    this.tokenExpiry = this.configService.get<number>('auth.csrf.expiry') || 3600000; // 1 hour default
  }

  /**
   * Generate a random secret key
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a CSRF token for a session
   */
  generateToken(sessionId: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + this.tokenExpiry);
    const data = `${sessionId}:${expiresAt.getTime()}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    const token = Buffer.from(`${data}:${signature}`).toString('base64');

    return { token, expiresAt };
  }

  /**
   * Validate a CSRF token
   */
  validateToken(sessionId: string, token: string): boolean {
    if (!token || !sessionId) {
      return false;
    }

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [tokenSessionId, expiryTimestamp, signature] = decoded.split(':');

      // Check if token belongs to the correct session
      if (tokenSessionId !== sessionId) {
        return false;
      }

      // Check if token has expired
      const expiresAt = parseInt(expiryTimestamp, 10);
      if (isNaN(expiresAt) || expiresAt < Date.now()) {
        return false;
      }

      // Verify signature
      const data = `${tokenSessionId}:${expiryTimestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(data)
        .digest('hex');

      return signature === expectedSignature;
    } catch {
      return false;
    }
  }

  /**
   * Get session ID from request (create if not exists)
   */
  getSessionId(request: any): string {
    if (!request.sessionId) {
      request.sessionId = crypto.randomBytes(16).toString('hex');
    }
    return request.sessionId;
  }
}