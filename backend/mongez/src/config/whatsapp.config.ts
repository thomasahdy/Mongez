import { registerAs } from '@nestjs/config';

/**
 * WhatsApp (Meta Cloud API) configuration.
 *
 * All values come from the environment. The Meta access token / app secret are
 * NOT required in dev — the WhatsAppChannel/Service gracefully no-op when they
 * are missing (same posture as the EmailChannel Ethereal fallback). Provide
 * real values in production to enable outbound delivery.
 */
export default registerAs('whatsapp', () => ({
  /** Meta Graph API base URL. */
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
  /** Phone Number ID (fallback when no WhatsAppAccount row is configured). */
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  /** WhatsApp Business Account ID (fallback). */
  wabaId: process.env.WHATSAPP_WABA_ID || '',
  /** System-user permanent access token (fallback). */
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  /** App secret used to verify `X-Hub-Signature-256` on webhooks. */
  appSecret: process.env.WHATSAPP_APP_SECRET || '',
  /** Verify token for the GET webhook challenge. */
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'mongez-whatsapp-verify',
  /** Key used to AES-256 encrypt stored access tokens. */
  encryptionKey:
    process.env.MESSAGING_ENCRYPTION_KEY ||
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    'dev-encryption-key-32-chars-long',
  /** Public base URL for the Meta webhook (`<base>/api/v1/whatsapp/webhook`). */
  webhookPublicUrl: process.env.WHATSAPP_WEBHOOK_PUBLIC_URL || '',
}));
