import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppRepository } from '../repositories/whatsapp.repository';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../../shared/services/encryption.service';

const mockAxiosInstance = {
  post: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let repo: jest.Mocked<WhatsAppRepository>;
  let config: jest.Mocked<ConfigService>;
  let encryption: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    repo = {
      findActiveAccountBySpace: jest.fn(),
    } as any;

    config = {
      get: jest.fn((key: string) => {
        if (key === 'whatsapp.apiUrl') return 'https://mock.graph.facebook.com/v20.0';
        if (key === 'whatsapp.appSecret' || key === 'WHATSAPP_APP_SECRET') return 'app-secret';
        if (key === 'whatsapp.verifyToken') return 'verify-token';
        return null;
      }),
    } as any;

    encryption = {
      decrypt: jest.fn((val) => `decrypted-${val}`),
      encrypt: jest.fn((val) => `encrypted-${val}`),
      safeEqual: jest.fn((a, b) => a === b),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: WhatsAppRepository, useValue: repo },
        { provide: ConfigService, useValue: config },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    mockAxiosInstance.post.mockReset();
  });

  describe('resolveAccount', () => {
    it('should return decrypted active account from DB when available', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue({
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'enc-token',
        displayName: 'My WhatsApp Account',
        webhookSecret: 'secret',
        isActive: true,
      } as any);

      const result = await service.resolveAccount('space-1');

      expect(repo.findActiveAccountBySpace).toHaveBeenCalledWith('space-1');
      expect(encryption.decrypt).toHaveBeenCalledWith('enc-token');
      expect(result).toEqual({
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'decrypted-enc-token',
        displayName: 'My WhatsApp Account',
        webhookSecret: 'secret',
        source: 'db',
      });
    });

    it('should fall back to env variables when DB config is not found', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue(null);
      config.get.mockImplementation((key: string) => {
        if (key === 'whatsapp.phoneNumberId') return 'env-phone-id';
        if (key === 'whatsapp.accessToken') return 'env-token';
        if (key === 'whatsapp.wabaId') return 'env-waba-id';
        if (key === 'whatsapp.appSecret') return 'env-secret';
        return null;
      });

      const result = await service.resolveAccount('space-1');

      expect(result).toEqual({
        spaceId: 'space-1',
        phoneNumberId: 'env-phone-id',
        wabaId: 'env-waba-id',
        accessToken: 'env-token',
        displayName: 'Mongez',
        webhookSecret: 'env-secret',
        source: 'env',
      });
    });

    it('should return null when neither DB config nor Env config is present', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue(null);
      config.get.mockReturnValue(null);

      const result = await service.resolveAccount('space-1');

      expect(result).toBeNull();
    });
  });

  describe('sendText', () => {
    it('should send a plain text message successfully', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          messages: [{ id: 'wa-msg-id-123' }],
        },
      });

      const result = await service.sendText(account, '+1234567890', 'Hello world');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/phone-id-1/messages'),
        {
          messaging_product: 'whatsapp',
          to: '1234567890',
          type: 'text',
          text: { body: 'Hello world', preview_url: false },
        },
        {
          headers: {
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual({
        status: 'SENT',
        waMessageId: 'wa-msg-id-123',
        raw: { messages: [{ id: 'wa-msg-id-123' }] },
      });
    });

    it('should fall back to plain text if template fails', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post
        .mockRejectedValueOnce({
          response: { data: { error: { code: 132000, message: 'Template not approved' } } },
        })
        .mockResolvedValueOnce({
          data: { messages: [{ id: 'fallback-msg-id' }] },
        });

      const result = await service.sendText(account, '+1234567890', 'Hello template text', 'my_template');

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('SENT');
      expect(result.waMessageId).toBe('fallback-msg-id');
    });
  });

  describe('sendTemplate', () => {
    it('should map bodyText OTP code if match found and parameters not provided', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post.mockResolvedValue({
        data: { messages: [{ id: 'wa-msg-id-tpl' }] },
      });

      const result = await service.sendTemplate(account, '+1234567890', 'my_otp_template', 'Your OTP is 987654. Code valid for 5 min.');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          messaging_product: 'whatsapp',
          to: '1234567890',
          type: 'template',
          template: {
            name: 'my_otp_template',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: '987654' }],
              },
            ],
          },
        },
        expect.any(Object)
      );
      expect(result.status).toBe('SENT');
    });

    it('should use explicit parameters array when provided', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post.mockResolvedValue({
        data: { messages: [{ id: 'wa-msg-id-tpl' }] },
      });

      await service.sendTemplate(account, '+1234567890', 'complex_template', undefined, ['Param1', 'Param2']);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          template: {
            name: 'complex_template',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Param1' },
                  { type: 'text', text: 'Param2' },
                ],
              },
            ],
          },
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendInteractiveButtons', () => {
    it('should send buttons when buttons array is not empty', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post.mockResolvedValue({
        data: { messages: [{ id: 'interactive-msg-id' }] },
      });

      const buttons = [
        { id: 'btn-1', title: 'Approve' },
        { id: 'btn-2', title: 'Reject' },
      ];

      const result = await service.sendInteractiveButtons(account, '+1234567890', 'Verify action:', buttons);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        {
          messaging_product: 'whatsapp',
          to: '1234567890',
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: 'Verify action:' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'btn-1', title: 'Approve' } },
                { type: 'reply', reply: { id: 'btn-2', title: 'Reject' } },
              ],
            },
          },
        },
        expect.any(Object)
      );
      expect(result.status).toBe('SENT');
    });

    it('should fall back to plain text if buttons array is empty', async () => {
      const account = {
        spaceId: 'space-1',
        phoneNumberId: 'phone-id-1',
        wabaId: 'waba-id-1',
        accessToken: 'token-123',
        displayName: 'DispName',
        source: 'db',
      } as any;

      mockAxiosInstance.post.mockResolvedValue({
        data: { messages: [{ id: 'fallback-text-id' }] },
      });

      const result = await service.sendInteractiveButtons(account, '+1234567890', 'No buttons here', []);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'text',
          text: { body: 'No buttons here', preview_url: false },
        }),
        expect.any(Object)
      );
      expect(result.status).toBe('SENT');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true if signature matches', () => {
      encryption.safeEqual.mockReturnValue(true);
      const result = service.verifyWebhookSignature('payload', 'sha256=hash');
      expect(result).toBe(true);
    });

    it('should return false if signature header is missing', () => {
      const result = service.verifyWebhookSignature('payload', undefined);
      expect(result).toBe(false);
    });
  });

  describe('verifyChallengeToken', () => {
    it('should return true if token matches verifyToken config', () => {
      encryption.safeEqual.mockReturnValue(true);
      const result = service.verifyChallengeToken('matching-token');
      expect(result).toBe(true);
    });
  });
});
