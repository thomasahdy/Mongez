import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { TelegramRepository } from '../repositories/telegram.repository';

export interface ResolvedTelegramAccount {
  spaceId: string;
  botToken: string; // decrypted
  botUsername: string;
  source: 'db' | 'env';
  webhookPathId?: string;
}

export interface TelegramSendResult {
  ok: boolean;
  tgMessageId?: number;
  errorCode?: string;
  raw?: any;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly http: AxiosInstance;
  private readonly apiUrl: string;

  constructor(
    private readonly repo: TelegramRepository,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {
    this.apiUrl =
      this.config.get<string>('telegram.apiUrl') || 'https://api.telegram.org';
    this.http = axios.create({ timeout: 15000 });
  }

  /** Resolve the active account for a space, decrypting the bot token. */
  async resolveAccount(
    spaceId: string,
  ): Promise<ResolvedTelegramAccount | null> {
    let dbAccount = await this.repo.findActiveAccountBySpace(spaceId);
    if (dbAccount && dbAccount.isActive) {
      let botToken: string;
      try {
        botToken = this.encryption.decrypt(dbAccount.botToken);
      } catch {
        botToken = dbAccount.botToken; // legacy plaintext fallback
      }

      let webhookPathId = dbAccount.webhookPathId;
      if (!webhookPathId) {
        webhookPathId = crypto.randomUUID();
        dbAccount = await this.repo.updateAccountWebhookPathId(dbAccount.id, webhookPathId);
      }

      return {
        spaceId,
        botToken,
        botUsername: dbAccount.botUsername,
        source: 'db',
        webhookPathId,
      };
    }

    const envToken = this.config.get<string>('telegram.botToken') || '';
    if (envToken) {
      const envTokenHash = crypto
        .createHash('sha256')
        .update(envToken)
        .digest('hex');
      return {
        spaceId,
        botToken: envToken,
        botUsername: this.config.get<string>('telegram.botUsername') || '',
        source: 'env',
        webhookPathId: envTokenHash,
      };
    }
    return null;
  }

  /**
   * Identify which space account a webhook is for, by matching the webhookPathId.
   */
  async resolveAccountByPathId(
    pathId: string,
  ): Promise<ResolvedTelegramAccount | null> {
    const dbAccount = await this.repo.findActiveAccountByPathId(pathId);
    if (dbAccount && dbAccount.isActive) {
      let decrypted: string;
      try {
        decrypted = this.encryption.decrypt(dbAccount.botToken);
      } catch {
        decrypted = dbAccount.botToken;
      }
      return {
        spaceId: dbAccount.spaceId,
        botToken: decrypted,
        botUsername: dbAccount.botUsername,
        source: 'db',
        webhookPathId: dbAccount.webhookPathId || undefined,
      };
    }

    // Env fallback matching SHA-255 hash of envToken
    const envToken = this.config.get<string>('telegram.botToken') || '';
    if (envToken) {
      const envTokenHash = crypto
        .createHash('sha256')
        .update(envToken)
        .digest('hex');
      if (this.encryption.safeEqual(envTokenHash, pathId)) {
        return {
          spaceId: '__env__',
          botToken: envToken,
          botUsername: this.config.get<string>('telegram.botUsername') || '',
          source: 'env',
          webhookPathId: envTokenHash,
        };
      }
    }
    return null;
  }

  /** Strip HTML/XML tags and decode common entities for safe plain-text delivery */
  private sanitizeText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // strip all HTML/XML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async sendMessage(
    botToken: string,
    chatId: string,
    text: string,
    options?: { replyMarkup?: any; parseMode?: string },
  ): Promise<TelegramSendResult> {
    try {
      const safeText = this.sanitizeText(text);
      const body: any = {
        chat_id: chatId,
        text: safeText,
        // No parse_mode — send as plain text to avoid HTML entity errors
        // from notification bodies that may contain unsupported tags
      };
      if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
      const res: AxiosResponse = await this.http.post(
        `${this.apiUrl}/bot${botToken}/sendMessage`,
        body,
      );
      return {
        ok: true,
        tgMessageId: res.data?.result?.message_id,
        raw: res.data,
      };
    } catch (err: any) {
      const code = err?.response?.data?.error_code
        ? String(err.response.data.error_code)
        : err?.code
          ? String(err.code)
          : 'UNKNOWN';
      this.logger.error(
        `Telegram sendMessage failed: ${err.message}${err?.response ? ` | ${JSON.stringify(err.response.data)}` : ''}`,
      );
      return { ok: false, errorCode: code, raw: err?.response?.data };
    }
  }

  async setWebhook(
    botToken: string,
    url: string,
    secretToken?: string,
  ): Promise<TelegramSendResult> {
    try {
      const body: any = { url };
      if (secretToken) body.secret_token = secretToken;
      const res: AxiosResponse = await this.http.post(
        `${this.apiUrl}/bot${botToken}/setWebhook`,
        body,
      );
      return { ok: !!res.data?.ok, raw: res.data };
    } catch (err: any) {
      return {
        ok: false,
        errorCode: err?.response?.data?.error_code
          ? String(err.response.data.error_code)
          : 'UNKNOWN',
      };
    }
  }

  async answerCallbackQuery(
    botToken: string,
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramSendResult> {
    try {
      const res: AxiosResponse = await this.http.post(
        `${this.apiUrl}/bot${botToken}/answerCallbackQuery`,
        {
          callback_query_id: callbackQueryId,
          text,
        },
      );
      return { ok: !!res.data?.ok, raw: res.data };
    } catch (err: any) {
      return {
        ok: false,
        errorCode: err?.response?.data?.error_code
          ? String(err.response.data.error_code)
          : 'UNKNOWN',
      };
    }
  }

  /** Verify the optional `X-Telegram-Bot-Api-Secret-Token` header. */
  verifySecretToken(headerValue: string | undefined): boolean {
    const expected =
      this.config.get<string>('telegram.webhookSecretToken') || '';
    if (!expected) return true; // not configured → skip (dev)
    if (!headerValue) return false;
    return this.encryption.safeEqual(headerValue, expected);
  }
}
