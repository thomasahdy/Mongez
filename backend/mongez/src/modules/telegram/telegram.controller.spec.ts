import { Test, TestingModule } from '@nestjs/testing';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './services/telegram.service';
import { TelegramRepository } from './repositories/telegram.repository';
import { EncryptionService } from '../../shared/services/encryption.service';
import { MessagingCommandExecutor } from '../messaging/commands/messaging-command-executor.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('TelegramController', () => {
  let controller: TelegramController;
  let service: jest.Mocked<TelegramService>;
  let repo: jest.Mocked<TelegramRepository>;
  let encryption: jest.Mocked<EncryptionService>;
  let executor: jest.Mocked<MessagingCommandExecutor>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    service = {
      verifySecretToken: jest.fn(),
      resolveAccountByToken: jest.fn(),
      resolveAccount: jest.fn(),
      sendMessage: jest.fn(),
      answerCallbackQuery: jest.fn(),
      setWebhook: jest.fn(),
    } as any;

    repo = {
      findContactByChat: jest.fn(),
      createMessage: jest.fn(),
      findActiveAccountBySpace: jest.fn(),
      findContact: jest.fn(),
      upsertAccount: jest.fn(),
      upsertContact: jest.fn(),
    } as any;

    encryption = {
      encrypt: jest.fn((val) => `encrypted-${val}`),
    } as any;

    executor = {
      handleInbound: jest.fn(),
    } as any;

    config = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: TelegramService, useValue: service },
        { provide: TelegramRepository, useValue: repo },
        { provide: EncryptionService, useValue: encryption },
        { provide: MessagingCommandExecutor, useValue: executor },
        { provide: ConfigService, useValue: config },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SpaceMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  describe('receiveWebhook', () => {
    it('should verify secret token and route updates to executor', async () => {
      service.verifySecretToken.mockReturnValue(true);
      service.resolveAccountByToken.mockResolvedValue({
        spaceId: 'space-1',
        botToken: 'bot-token-123',
        botUsername: 'MyBot',
        source: 'db',
      });

      const body = {
        message: {
          message_id: 456,
          chat: { id: 11111 },
          text: '/start',
          from: { username: 'tom' },
        },
      };

      repo.findContactByChat.mockResolvedValue({
        userId: 'user-1',
        chatId: '11111',
      } as any);

      executor.handleInbound.mockResolvedValue({ reply: 'Hello Thomas' });

      const req = { headers: { 'x-telegram-bot-api-secret-token': 'secret-tok' } } as any;

      const result = await controller.receiveWebhook('my-token', body, req);

      expect(service.verifySecretToken).toHaveBeenCalledWith('secret-tok');
      expect(service.resolveAccountByToken).toHaveBeenCalledWith('my-token');
      expect(result).toEqual({ status: 'ok' });

      // Wait a moment for background task
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(repo.findContactByChat).toHaveBeenCalledWith('11111', 'space-1');
      expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'INBOUND',
        chatId: '11111',
        content: '/start',
      }));
      expect(executor.handleInbound).toHaveBeenCalledWith({
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '/start',
      });
      expect(service.sendMessage).toHaveBeenCalledWith('bot-token-123', '11111', 'Hello Thomas');
    });

    it('should prompt user to link account if contact is not registered', async () => {
      service.verifySecretToken.mockReturnValue(true);
      service.resolveAccountByToken.mockResolvedValue({
        spaceId: 'space-1',
        botToken: 'bot-token-123',
        botUsername: 'MyBot',
        source: 'db',
      });

      const body = {
        message: {
          message_id: 456,
          chat: { id: 11111 },
          text: '/start',
        },
      };

      repo.findContactByChat.mockResolvedValue(null); // Contact not linked

      const req = { headers: {} } as any;
      await controller.receiveWebhook('my-token', body, req);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(service.sendMessage).toHaveBeenCalledWith(
        'bot-token-123',
        '11111',
        expect.stringContaining('Please link your Mongez account'),
      );
    });

    it('should handle callback_query updates', async () => {
      service.verifySecretToken.mockReturnValue(true);
      service.resolveAccountByToken.mockResolvedValue({
        spaceId: 'space-1',
        botToken: 'bot-token-123',
        botUsername: 'MyBot',
        source: 'db',
      });

      const body = {
        callback_query: {
          id: 'cq-id-789',
          message: { chat: { id: 11111 } },
          data: 'approve_1',
        },
      };

      repo.findContactByChat.mockResolvedValue({
        userId: 'user-1',
        chatId: '11111',
      } as any);

      executor.handleInbound.mockResolvedValue({
        reply: 'Approved successfully',
        callbackAnswer: 'Approved!',
      });

      const req = { headers: {} } as any;
      await controller.receiveWebhook('my-token', body, req);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executor.handleInbound).toHaveBeenCalledWith({
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '',
        callbackPayload: 'approve_1',
      });
      expect(service.answerCallbackQuery).toHaveBeenCalledWith('bot-token-123', 'cq-id-789', 'Approved!');
      expect(service.sendMessage).toHaveBeenCalledWith('bot-token-123', '11111', 'Approved successfully');
    });

    it('should throw UnauthorizedException if secret token check fails', async () => {
      service.verifySecretToken.mockReturnValue(false);
      const req = { headers: { 'x-telegram-bot-api-secret-token': 'bad-token' } } as any;

      await expect(controller.receiveWebhook('my-token', {}, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('setup', () => {
    it('should encrypt token and save space account', async () => {
      const dto = {
        botToken: 'raw-token',
        botUsername: 'MyBot',
        isActive: true,
      };

      repo.upsertAccount.mockResolvedValue({
        botUsername: 'MyBot',
        isActive: true,
      } as any);

      const result = await controller.setup('space-1', dto);

      expect(encryption.encrypt).toHaveBeenCalledWith('raw-token');
      expect(repo.upsertAccount).toHaveBeenCalledWith('space-1', {
        botToken: 'encrypted-raw-token',
        botUsername: 'MyBot',
        isActive: true,
      });
      expect(result).toEqual({
        spaceId: 'space-1',
        botUsername: 'MyBot',
        isActive: true,
      });
    });
  });

  describe('status', () => {
    it('should return configuration details and linked user contact details', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue({
        isActive: true,
        botUsername: 'MyBot',
      } as any);
      repo.findContact.mockResolvedValue({
        chatId: '11111',
        username: 'tom',
        optedIn: true,
        isVerified: true,
      } as any);

      const req = { user: { userId: 'user-1' } };

      const result = await controller.status('space-1', req);

      expect(result).toEqual({
        configured: true,
        isActive: true,
        botUsername: 'MyBot',
        contact: {
          chatId: '11111',
          username: 'tom',
          optedIn: true,
          isVerified: true,
        },
      });
    });
  });

  describe('registerContact', () => {
    it('should upsert user contact chat configuration', async () => {
      repo.upsertContact.mockResolvedValue({
        id: 'contact-id',
        chatId: '11111',
      } as any);

      const req = { user: { userId: 'user-1' } };
      const dto = { chatId: '11111', username: 'tom' };

      const result = await controller.registerContact('space-1', req, dto);

      expect(repo.upsertContact).toHaveBeenCalledWith('user-1', 'space-1', {
        chatId: '11111',
        username: 'tom',
      });
      expect(result).toEqual({
        contactId: 'contact-id',
        chatId: '11111',
      });
    });
  });

  describe('optOut', () => {
    it('should disable Telegram notifications', async () => {
      repo.findContact.mockResolvedValue({
        chatId: '11111',
        username: 'tom',
      } as any);
      repo.upsertContact.mockResolvedValue({
        optedIn: false,
      } as any);

      const req = { user: { userId: 'user-1' } };

      const result = await controller.optOut('space-1', req);

      expect(repo.upsertContact).toHaveBeenCalledWith('user-1', 'space-1', {
        chatId: '11111',
        username: 'tom',
        optedIn: false,
      });
      expect(result).toEqual({ optedIn: false });
    });

    it('should throw BadRequestException if contact is missing', async () => {
      repo.findContact.mockResolvedValue(null);
      const req = { user: { userId: 'user-1' } };

      await expect(controller.optOut('space-1', req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerWebhook', () => {
    it('should call service.setWebhook and return results', async () => {
      service.resolveAccount.mockResolvedValue({
        botToken: 'my-bot-token',
      } as any);
      config.get.mockImplementation((key: string) => {
        if (key === 'telegram.webhookPublicUrl') return 'https://public.mongez.com';
        if (key === 'telegram.webhookSecretToken') return 'webhook-secret';
        return null;
      });
      service.setWebhook.mockResolvedValue({ ok: true, raw: 'success-payload' });

      const result = await controller.registerWebhook('space-1');

      expect(service.resolveAccount).toHaveBeenCalledWith('space-1');
      expect(service.setWebhook).toHaveBeenCalledWith(
        'my-bot-token',
        'https://public.mongez.com/api/v1/telegram/webhook/my-bot-token',
        'webhook-secret',
      );
      expect(result).toEqual({
        webhookUrl: 'https://public.mongez.com/api/v1/telegram/webhook/my-bot-token',
        ok: true,
        raw: 'success-payload',
      });
    });
  });
});
