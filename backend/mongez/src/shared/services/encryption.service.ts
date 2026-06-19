import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * EncryptionService — AES-256-CBC symmetric encryption for secrets at rest
 * (WhatsApp access tokens, Telegram bot tokens, etc.).
 *
 * Mirrors the proven scheme used by IntegrationsService for Google tokens.
 * The encryption key is derived by SHA-256 hashing the configured passphrase,
 * so any sufficiently long string works as input.
 */
@Injectable()
export class EncryptionService {
  constructor(private readonly config: ConfigService) {}

  private resolveKey(passphrase?: string): Buffer {
    const key =
      passphrase ||
      this.config.get<string>('MESSAGING_ENCRYPTION_KEY') ||
      this.config.get<string>('INTEGRATION_ENCRYPTION_KEY') ||
      'dev-encryption-key-32-chars-long';
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(plaintext: string, passphrase?: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.resolveKey(passphrase),
      iv,
    );
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(payload: string, passphrase?: string): string {
    const [ivHex, data] = payload.split(':');
    if (!ivHex || !data) {
      throw new Error('Invalid encrypted payload format');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.resolveKey(passphrase),
      Buffer.from(ivHex, 'hex'),
    );
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /** Constant-time comparison for HMAC / signature verification. */
  safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
