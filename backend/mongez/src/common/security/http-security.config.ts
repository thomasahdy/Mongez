import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: ws:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

function splitOrigins(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildAllowedOrigins(config?: ConfigService): string[] {
  const configuredOrigins = [
    ...splitOrigins(process.env.FRONTEND_URLS),
    ...splitOrigins(config?.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL),
  ];

  return Array.from(new Set(configuredOrigins.length ? configuredOrigins : [DEFAULT_DEV_ORIGIN]));
}

export function createCorsOriginValidator(config?: ConfigService) {
  const allowedOrigins = buildAllowedOrigins(config);

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS'), false);
  };
}

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  res.removeHeader('X-Powered-By');
  next();
}
