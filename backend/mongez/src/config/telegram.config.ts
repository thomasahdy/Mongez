import { registerAs } from '@nestjs/config';

/**
 * Telegram Bot API configuration.
 *
 * The bot token is stored per-space in the `telegram_accounts` table (encrypted).
 * These env values are used as a global fallback / for bootstrapping the first
 * space, and for webhook security.
 */
export default registerAs('telegram', () => ({
  /** Telegram Bot API base URL. */
  apiUrl: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
  /** Default bot token (fallback when no TelegramAccount row is configured). */
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  /** Default bot username (fallback). */
  botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  /**
   * Secret token Telegram sends as `X-Telegram-Bot-Api-Secret-Token` on every
   * webhook push. Set the same value via `setWebhook(secret_token)`.
   */
  webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN || '',
  /** Key used to AES-256 encrypt stored bot tokens. */
  encryptionKey:
    process.env.MESSAGING_ENCRYPTION_KEY ||
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    'dev-encryption-key-32-chars-long',
  /** Public base URL for the Telegram webhook (`<base>/api/v1/telegram/webhook/<token>`). */
  webhookPublicUrl: process.env.TELEGRAM_WEBHOOK_PUBLIC_URL || '',
}));
