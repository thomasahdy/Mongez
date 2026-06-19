import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { WhatsAppRepository } from '../repositories/whatsapp.repository';

export interface ResolvedWhatsappAccount {
  spaceId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string; // decrypted, ready for use
  displayName: string;
  webhookSecret?: string | null;
  source: 'db' | 'env';
}

export interface SendResult {
  waMessageId?: string;
  status: 'SENT' | 'FAILED';
  errorCode?: string;
  raw?: any;
}

export interface InteractiveButton {
  id: string;
  title: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly http: AxiosInstance;
  private readonly apiUrl: string;

  constructor(
    private readonly repo: WhatsAppRepository,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {
    this.apiUrl =
      this.config.get<string>('whatsapp.apiUrl') ||
      'https://graph.facebook.com/v20.0';
    this.http = axios.create({ timeout: 15000 });
  }

  /**
   * Resolve the active account for a space, decrypting the stored token.
   * Falls back to environment credentials when no DB account exists (dev).
   * Returns null when neither is configured — callers should no-op.
   */
  async resolveAccount(
    spaceId: string,
  ): Promise<ResolvedWhatsappAccount | null> {
    const dbAccount = await this.repo.findActiveAccountBySpace(spaceId);
    if (dbAccount && dbAccount.isActive) {
      let accessToken: string;
      try {
        accessToken = this.encryption.decrypt(dbAccount.accessToken);
      } catch (err) {
        this.logger.error(
          `Failed to decrypt WhatsApp access token for space ${spaceId}`,
        );
        accessToken = dbAccount.accessToken; // assume plaintext fallback (legacy)
      }
      return {
        spaceId,
        phoneNumberId: dbAccount.phoneNumberId,
        wabaId: dbAccount.wabaId,
        accessToken,
        displayName: dbAccount.displayName,
        webhookSecret: dbAccount.webhookSecret,
        source: 'db',
      };
    }

    // Env fallback (dev / bootstrapping)
    const envPhone = this.config.get<string>('whatsapp.phoneNumberId') || '';
    const envToken = this.config.get<string>('whatsapp.accessToken') || '';
    if (envPhone && envToken) {
      return {
        spaceId,
        phoneNumberId: envPhone,
        wabaId: this.config.get<string>('whatsapp.wabaId') || '',
        accessToken: envToken,
        displayName: 'Mongez',
        webhookSecret: this.config.get<string>('whatsapp.appSecret') || '',
        source: 'env',
      };
    }

    return null;
  }

  /** Send a plain text message. */
  async sendText(
    account: ResolvedWhatsappAccount,
    toPhone: string,
    text: string,
  ): Promise<SendResult> {
    return this.sendMessage(account, {
      messaging_product: 'whatsapp',
      to: this.normalizePhone(toPhone),
      type: 'text',
      text: { body: text, preview_url: false },
    });
  }

  /**
   * Send a quick-reply interactive button message (e.g. Approve / Reject).
   * NOTE: in production this requires a pre-approved template; the processor
   * records a FAILED status if Meta rejects it.
   */
  async sendInteractiveButtons(
    account: ResolvedWhatsappAccount,
    toPhone: string,
    bodyText: string,
    buttons: InteractiveButton[],
  ): Promise<SendResult> {
    if (!buttons.length) return this.sendText(account, toPhone, bodyText);
    return this.sendMessage(account, {
      messaging_product: 'whatsapp',
      to: this.normalizePhone(toPhone),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  private async sendMessage(
    account: ResolvedWhatsappAccount,
    body: any,
  ): Promise<SendResult> {
    const url = `${this.apiUrl}/${account.phoneNumberId}/messages`;
    try {
      const res: AxiosResponse = await this.http.post(url, body, {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const waMessageId = res.data?.messages?.[0]?.id;
      this.logger.log(
        `WhatsApp message dispatched (waId=${waMessageId || 'n/a'})`,
      );
      return { waMessageId, status: 'SENT', raw: res.data };
    } catch (err: any) {
      const code = err?.response?.data?.error?.code
        ? String(err.response.data.error.code)
        : err?.code
          ? String(err.code)
          : 'UNKNOWN';
      this.logger.error(
        `WhatsApp send failed: ${err.message}${err?.response ? ` | ${JSON.stringify(err.response.data)}` : ''}`,
      );
      return { status: 'FAILED', errorCode: code, raw: err?.response?.data };
    }
  }

  /**
   * Verify the Meta `X-Hub-Signature-256` header against the raw request body
   * using the configured App Secret (HMAC-SHA256).
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) return false;
    const secret =
      this.config.get<string>('whatsapp.appSecret') ||
      this.config.get<string>('WHATSAPP_APP_SECRET') ||
      '';
    if (!secret) {
      this.logger.warn(
        'WhatsApp app secret not configured — skipping signature verification (dev only).',
      );
      return true;
    }
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.encryption.safeEqual(expected, signatureHeader);
  }

  /** Webhook GET challenge verify token check. */
  verifyChallengeToken(token: string | undefined): boolean {
    const expected =
      this.config.get<string>('whatsapp.verifyToken') ||
      'mongez-whatsapp-verify';
    return !!token && this.encryption.safeEqual(token, expected);
  }

  private normalizePhone(phone: string): string {
    // Meta expects E.164 without the leading "+".
    return phone.replace(/[^\d]/g, '');
  }
}
