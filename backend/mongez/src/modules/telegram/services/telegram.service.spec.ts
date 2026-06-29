import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { TelegramRepository } from '../repositories/telegram.repository';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../../shared/services/encryption.service';
import * as crypto from 'crypto';

const mockAxiosInstance = {
  post: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

describe('TelegramService', () => {
  let service: TelegramService;
  let repo: jest.Mocked<TelegramRepository>;
  let config: jest.Mocked<ConfigService>;
  let encryption: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    repo = {
      findActiveAccountBySpace: jest.fn(),
      findAllActiveAccounts: jest.fn(),
      findActiveAccountByPathId: jest.fn(),
      updateAccountWebhookPathId: jest.fn(),
    } as any;

    config = {
      get: jest.fn((key: string) => {
        if (key === 'telegram.apiUrl') return 'https://mock.api.telegram.org';
        if (key === 'telegram.webhookSecretToken') return 'webhook-secret-token';
        return null;
      }),
    } as any;

    encryption = {
      decrypt: jest.fn((val) => `decrypted-${val}`),
      safeEqual: jest.fn((a, b) => a === b),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: TelegramRepository, useValue: repo },
        { provide: ConfigService, useValue: config },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    mockAxiosInstance.post.mockReset();
  });

  describe('resolveAccount', () => {
    it('should decrypt botToken and return DB account details when active in DB', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue({
        id: 'acc-1',
        spaceId: 'space-1',
        botToken: 'enc-bot-token',
        botUsername: 'MongezBot',
        isActive: true,
        webhookPathId: 'existing-path-id',
      } as any);

      const result = await service.resolveAccount('space-1');

      expect(repo.findActiveAccountBySpace).toHaveBeenCalledWith('space-1');
      expect(encryption.decrypt).toHaveBeenCalledWith('enc-bot-token');
      expect(result).toEqual({
        spaceId: 'space-1',
        botToken: 'decrypted-enc-bot-token',
        botUsername: 'MongezBot',
        source: 'db',
        webhookPathId: 'existing-path-id',
      });
    });

    it('should fall back to env bot configuration when not active in DB', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue(null);
      config.get.mockImplementation((key: string) => {
        if (key === 'telegram.botToken') return 'env-bot-token';
        if (key === 'telegram.botUsername') return 'EnvMongezBot';
        return null;
      });

      const result = await service.resolveAccount('space-1');

      expect(result).toEqual({
        spaceId: 'space-1',
        botToken: 'env-bot-token',
        botUsername: 'EnvMongezBot',
        source: 'env',
        webhookPathId: crypto.createHash('sha256').update('env-bot-token').digest('hex'),
      });
    });

    it('should return null when no credentials exist in DB or Env', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue(null);
      config.get.mockReturnValue(null);

      const result = await service.resolveAccount('space-1');

      expect(result).toBeNull();
    });
  });

  describe('resolveAccountByPathId', () => {
    it('should query DB active account directly by pathId', async () => {
      repo.findActiveAccountByPathId.mockResolvedValue({
        spaceId: 'space-2',
        botToken: 'enc-tok-2',
        botUsername: 'Bot2',
        isActive: true,
        webhookPathId: 'webhook-path-2',
      } as any);

      const result = await service.resolveAccountByPathId('webhook-path-2');

      expect(repo.findActiveAccountByPathId).toHaveBeenCalledWith('webhook-path-2');
      expect(result).toEqual({
        spaceId: 'space-2',
        botToken: 'decrypted-enc-tok-2',
        botUsername: 'Bot2',
        source: 'db',
        webhookPathId: 'webhook-path-2',
      });
    });

    it('should check env config fallback if DB accounts do not match', async () => {
      repo.findActiveAccountByPathId.mockResolvedValue(null);
      config.get.mockImplementation((key: string) => {
        if (key === 'telegram.botToken') return 'env-bot-token';
        if (key === 'telegram.botUsername') return 'EnvBot';
        return null;
      });
      encryption.safeEqual.mockImplementation((a, b) => a === b);

      const envTokenHash = crypto.createHash('sha256').update('env-bot-token').digest('hex');
      const result = await service.resolveAccountByPathId(envTokenHash);

      expect(result).toEqual({
        spaceId: '__env__',
        botToken: 'env-bot-token',
        botUsername: 'EnvBot',
        source: 'env',
        webhookPathId: envTokenHash,
      });
    });
  });

  describe('sendMessage', () => {
    it('should send a POST request without parse mode', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          result: { message_id: 9999 },
        },
      });

      const result = await service.sendMessage('token-abc', 'chat-id-1', 'Hello world');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://mock.api.telegram.org/bottoken-abc/sendMessage',
        {
          chat_id: 'chat-id-1',
          text: 'Hello world',
        },
      );
      expect(result).toEqual({
        ok: true,
        tgMessageId: 9999,
        raw: { result: { message_id: 9999 } },
      });
    });

    it('should capture response errors and return failed result with code', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        message: 'Request failed',
        response: {
          data: { error_code: 400, description: 'Chat not found' },
        },
      });

      const result = await service.sendMessage('token-abc', 'invalid-chat', 'Hello');

      expect(result).toEqual({
        ok: false,
        errorCode: '400',
        raw: { error_code: 400, description: 'Chat not found' },
      });
    });
  });

  describe('setWebhook', () => {
    it('should call setWebhook endpoint with secret_token when provided', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { ok: true } });

      const result = await service.setWebhook('token-abc', 'https://webhook.url', 'secret-val');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://mock.api.telegram.org/bottoken-abc/setWebhook',
        {
          url: 'https://webhook.url',
          secret_token: 'secret-val',
        },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('answerCallbackQuery', () => {
    it('should answer callback query', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { ok: true } });

      const result = await service.answerCallbackQuery('token-abc', 'query-id-1', 'Acknowledged');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://mock.api.telegram.org/bottoken-abc/answerCallbackQuery',
        {
          callback_query_id: 'query-id-1',
          text: 'Acknowledged',
        },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('verifySecretToken', () => {
    it('should return true if token matches', () => {
      encryption.safeEqual.mockReturnValue(true);
      const result = service.verifySecretToken('matching-secret');
      expect(result).toBe(true);
    });
  });
});
