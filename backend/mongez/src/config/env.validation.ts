import { Logger } from '@nestjs/common';

/**
 * Fail-fast environment validation, wired into ConfigModule.forRoot({ validate }).
 *
 * In production a missing or placeholder secret is a hard boot error — we would
 * rather crash on startup than silently run with insecure defaults (weak JWT
 * signing keys, a shared dev encryption key, etc.). In non-production we only
 * warn so local/test workflows stay frictionless.
 */

const DEFAULT_ACCESS_SECRET = 'your-very-secure-access-token-secret-change-in-production';
const DEFAULT_REFRESH_SECRET = 'your-very-secure-refresh-token-secret-change-in-production';
const DEFAULT_INTEGRATION_KEY = 'dev-encryption-key-32-chars-long';
const DEFAULT_AI_KEY = 'dev-key';

interface EnvCheck {
  key: string;
  /** Reject when the value is missing/empty. */
  required?: boolean;
  /** Reject when the value equals one of these insecure placeholders. */
  forbidden?: string[];
  /** Reject when the value is shorter than this many characters. */
  minLength?: number;
  /** Human-readable reason surfaced in the error message. */
  hint?: string;
}

const PRODUCTION_CHECKS: EnvCheck[] = [
  { key: 'DATABASE_URL', required: true, hint: 'Postgres connection string' },
  { key: 'REDIS_URL', required: true, hint: 'Redis connection string (cache, queues, realtime)' },
  {
    key: 'JWT_ACCESS_TOKEN_SECRET',
    required: true,
    forbidden: [DEFAULT_ACCESS_SECRET],
    minLength: 32,
    hint: 'strong random secret, >= 32 chars',
  },
  {
    key: 'JWT_REFRESH_TOKEN_SECRET',
    required: true,
    forbidden: [DEFAULT_REFRESH_SECRET],
    minLength: 32,
    hint: 'strong random secret, >= 32 chars',
  },
  {
    key: 'AI_SERVICE_API_KEY',
    required: true,
    forbidden: [DEFAULT_AI_KEY],
    hint: 'shared secret between backend and AI service',
  },
  {
    key: 'INTEGRATION_ENCRYPTION_KEY',
    required: true,
    forbidden: [DEFAULT_INTEGRATION_KEY],
    minLength: 32,
    hint: 'encrypts stored OAuth/integration tokens at rest, >= 32 chars',
  },
];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const logger = new Logger('EnvValidation');
  const env = (config.NODE_ENV as string) || 'development';
  const isProduction = env === 'production';

  const problems: string[] = [];

  for (const check of PRODUCTION_CHECKS) {
    const raw = config[check.key];
    const value = typeof raw === 'string' ? raw.trim() : raw;

    if (check.required && (value === undefined || value === null || value === '')) {
      problems.push(`${check.key} is required (${check.hint ?? 'no default allowed'})`);
      continue;
    }
    if (typeof value === 'string') {
      if (check.forbidden?.includes(value)) {
        problems.push(`${check.key} must not use the insecure default value (${check.hint ?? ''})`.trim());
        continue;
      }
      if (check.minLength && value.length < check.minLength) {
        problems.push(`${check.key} must be at least ${check.minLength} characters (${check.hint ?? ''})`.trim());
      }
    }
  }

  if (problems.length > 0) {
    const message =
      `Environment validation failed for ${problems.length} variable(s):\n` +
      problems.map((p) => `  - ${p}`).join('\n');

    if (isProduction) {
      // Hard fail: do not boot a production process with insecure config.
      throw new Error(message);
    }
    logger.warn(
      `${message}\n(These are only warnings outside production, but MUST be fixed before deploying.)`,
    );
  }

  return config;
}
