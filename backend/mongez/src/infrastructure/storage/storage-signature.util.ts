import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const DEV_STORAGE_SIGNING_SECRET = 'super-secret-key';

function getRuntimeEnv(config: ConfigService): string {
  return (
    config.get<string>('app.env') ||
    config.get<string>('NODE_ENV') ||
    process.env.NODE_ENV ||
    'development'
  );
}

export function getStorageSigningSecret(config: ConfigService): string {
  const secret =
    config.get<string>('APP_SECRET')?.trim() ||
    config.get<string>('auth.jwt.accessTokenSecret')?.trim() ||
    config.get<string>('JWT_ACCESS_TOKEN_SECRET')?.trim() ||
    process.env.JWT_ACCESS_TOKEN_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (getRuntimeEnv(config) === 'production') {
    throw new Error('APP_SECRET or JWT_ACCESS_TOKEN_SECRET is required in production for signed storage URLs');
  }

  return DEV_STORAGE_SIGNING_SECRET;
}

export function createStorageSignature(config: ConfigService, key: string, expires: number): string {
  return crypto
    .createHmac('sha256', getStorageSigningSecret(config))
    .update(`${key}:${expires}`)
    .digest('hex');
}

export function createSignedStoragePath(
  config: ConfigService,
  key: string,
  expiresInSeconds = 3600,
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = createStorageSignature(config, key, expires);

  return `/api/v1/files/key/${encodeURIComponent(key)}/download?expires=${expires}&signature=${signature}`;
}

export function isValidStorageSignature(
  config: ConfigService,
  key: string,
  expires: string,
  signature: string,
): boolean {
  const expiresAt = Number(expires);

  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  const expected = createStorageSignature(config, key, expiresAt);
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isExpiredStorageSignature(expires: string): boolean {
  const expiresAt = Number(expires);

  return !Number.isFinite(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt;
}
