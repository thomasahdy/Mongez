import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppOtpService } from './services/whatsapp-otp.service';
import { WhatsAppRepository } from './repositories/whatsapp.repository';
import { EncryptionService } from '../../shared/services/encryption.service';
import { ConfigService } from '@nestjs/config';
import { MessagingCommandExecutor } from '../messaging/commands/messaging-command-executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from '../spaces/guards/space-member.guard';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let service: jest.Mocked<WhatsAppService>;
  let otpService: jest.Mocked<WhatsAppOtpService>;
  let repo: jest.Mocked<WhatsAppRepository>;
  let encryption: jest.Mocked<EncryptionService>;
  let config: jest.Mocked<ConfigService>;
  let executor: jest.Mocked<MessagingCommandExecutor>;

  beforeEach(async () => {
    service = {
      verifyChallengeToken: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      resolveAccount: jest.fn(),
      sendText: jest.fn(),
    } as any;

    otpService = {
      issueOtp: jest.fn(),
      confirmOtp: jest.fn(),
    } as any;

    repo = {
      findByPhoneNumberId: jest.fn(),
      findActiveAccountBySpace: jest.fn(),
      findContact: jest.fn(),
      findContactByPhone: jest.fn(),
      updateMessageByWaId: jest.fn(),
      createMessage: jest.fn(),
      updateContactWaId: jest.fn(),
      upsertAccount: jest.fn(),
      upsertContact: jest.fn(),
    } as any;

    encryption = {
      encrypt: jest.fn((val) => `encrypted-${val}`),
    } as any;

    config = {
      get: jest.fn(),
    } as any;

    executor = {
      handleInbound: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppService, useValue: service },
        { provide: WhatsAppOtpService, useValue: otpService },
        { provide: WhatsAppRepository, useValue: repo },
        { provide: EncryptionService, useValue: encryption },
        { provide: ConfigService, useValue: config },
        { provide: MessagingCommandExecutor, useValue: executor },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SpaceMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WhatsAppController>(WhatsAppController);
  });

  describe('verifyWebhook', () => {
    it('should send challenge when token is verified successfully', () => {
      service.verifyChallengeToken.mockReturnValue(true);
      const res = {
        status: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      controller.verifyWebhook('subscribe', 'token-123', 'my-challenge', res);

      expect(service.verifyChallengeToken).toHaveBeenCalledWith('token-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.type).toHaveBeenCalledWith('text/plain');
      expect(res.send).toHaveBeenCalledWith('my-challenge');
    });

    it('should throw UnauthorizedException when verification fails', () => {
      service.verifyChallengeToken.mockReturnValue(false);
      const res = {} as any;

      expect(() =>
        controller.verifyWebhook('subscribe', 'token-wrong', 'my-challenge', res),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('receiveWebhook', () => {
    it('should verify signature and process webhook statuses & messages', async () => {
      service.verifyWebhookSignature.mockReturnValue(true);
      const mockAccount = { spaceId: 'space-1' };
      repo.findByPhoneNumberId.mockResolvedValue(mockAccount as any);

      // Inbound text message mock payload
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: {
                    phone_number_id: 'wa-phone-id-1',
                    display_phone_number: '+1999999999',
                  },
                  statuses: [
                    {
                      id: 'msg-wa-id-123',
                      status: 'delivered',
                    },
                  ],
                  messages: [
                    {
                      id: 'inbound-wa-msg-id',
                      from: '1234567890',
                      type: 'text',
                      text: { body: 'Ping' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      // Mock contact & command execution
      repo.findContactByPhone.mockResolvedValue({
        id: 'contact-1',
        userId: 'user-1',
        isVerified: true,
        optedIn: true,
      } as any);
      executor.handleInbound.mockResolvedValue({ reply: 'Pong' });
      service.resolveAccount.mockResolvedValue({ spaceId: 'space-1' } as any);

      const req = { rawBody: Buffer.from(JSON.stringify(body)) } as any;

      const result = await controller.receiveWebhook(req, body, 'sha-sig');

      expect(service.verifyWebhookSignature).toHaveBeenCalledWith(req.rawBody, 'sha-sig');
      expect(result).toEqual({ status: 'ok' });

      // Wait a brief moment for background processUpdate execution
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(repo.findByPhoneNumberId).toHaveBeenCalledWith('wa-phone-id-1');
      expect(repo.updateMessageByWaId).toHaveBeenCalledWith('msg-wa-id-123', {
        status: 'DELIVERED',
        errorCode: null,
      });
      expect(repo.findContactByPhone).toHaveBeenCalledWith('+1234567890', 'space-1');
      expect(repo.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          direction: 'INBOUND',
          fromPhone: '+1234567890',
          content: 'Ping',
        }),
      );
      expect(executor.handleInbound).toHaveBeenCalledWith({
        channel: 'WHATSAPP',
        spaceId: 'space-1',
        userId: 'user-1',
        text: 'Ping',
        callbackPayload: undefined,
      });
      expect(service.sendText).toHaveBeenCalledWith(
        expect.any(Object),
        '+1234567890',
        'Pong',
      );
    });

    it('should throw UnauthorizedException when signature check fails', async () => {
      service.verifyWebhookSignature.mockReturnValue(false);
      const req = { rawBody: 'raw' } as any;

      await expect(controller.receiveWebhook(req, {}, 'bad-sig')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('setup', () => {
    it('should encrypt access token and save active account configuration', async () => {
      const dto = {
        phoneNumberId: 'phone-1',
        wabaId: 'waba-1',
        accessToken: 'token-plaintext',
        displayName: 'Mongez Space Bot',
        webhookSecret: 'wh-secret',
        isActive: true,
      };

      repo.upsertAccount.mockResolvedValue({
        phoneNumberId: 'phone-1',
        displayName: 'Mongez Space Bot',
        isActive: true,
      } as any);

      const result = await controller.setup('space-1', dto);

      expect(encryption.encrypt).toHaveBeenCalledWith('token-plaintext');
      expect(repo.upsertAccount).toHaveBeenCalledWith('space-1', {
        phoneNumberId: 'phone-1',
        wabaId: 'waba-1',
        accessToken: 'encrypted-token-plaintext',
        displayName: 'Mongez Space Bot',
        webhookSecret: 'wh-secret',
        isActive: true,
      });
      expect(result).toEqual({
        spaceId: 'space-1',
        phoneNumberId: 'phone-1',
        displayName: 'Mongez Space Bot',
        isActive: true,
      });
    });
  });

  describe('status', () => {
    it('should return configuration details and verification status of current user contact', async () => {
      repo.findActiveAccountBySpace.mockResolvedValue({
        isActive: true,
        displayName: 'Mongez Space Bot',
      } as any);
      repo.findContact.mockResolvedValue({
        phoneNumber: '+1234567890',
        optedIn: true,
        isVerified: true,
      } as any);

      const req = { user: { userId: 'user-1' } };

      const result = await controller.status('space-1', req);

      expect(repo.findActiveAccountBySpace).toHaveBeenCalledWith('space-1');
      expect(repo.findContact).toHaveBeenCalledWith('user-1', 'space-1');
      expect(result).toEqual({
        configured: true,
        isActive: true,
        displayName: 'Mongez Space Bot',
        contact: {
          phoneNumber: '+1234567890',
          optedIn: true,
          isVerified: true,
        },
      });
    });
  });

  describe('registerContact', () => {
    it('should upsert user contact phone configuration', async () => {
      repo.upsertContact.mockResolvedValue({
        id: 'contact-id',
        phoneNumber: '+1234567890',
      } as any);

      const req = { user: { userId: 'user-1' } };
      const dto = { phoneNumber: '+1234567890', waId: 'wa-id-123' };

      const result = await controller.registerContact('space-1', req, dto);

      expect(repo.upsertContact).toHaveBeenCalledWith('user-1', 'space-1', {
        phoneNumber: '+1234567890',
        waId: 'wa-id-123',
      });
      expect(result).toEqual({
        contactId: 'contact-id',
        phoneNumber: '+1234567890',
      });
    });
  });

  describe('optOut', () => {
    it('should disable WhatsApp notifications for contact', async () => {
      repo.findContact.mockResolvedValue({
        phoneNumber: '+1234567890',
        waId: 'wa-id-123',
      } as any);
      repo.upsertContact.mockResolvedValue({
        optedIn: false,
      } as any);

      const req = { user: { userId: 'user-1' } };

      const result = await controller.optOut('space-1', req);

      expect(repo.findContact).toHaveBeenCalledWith('user-1', 'space-1');
      expect(repo.upsertContact).toHaveBeenCalledWith('user-1', 'space-1', {
        phoneNumber: '+1234567890',
        waId: 'wa-id-123',
        optedIn: false,
      });
      expect(result).toEqual({ optedIn: false });
    });

    it('should throw BadRequestException if no contact exists', async () => {
      repo.findContact.mockResolvedValue(null);
      const req = { user: { userId: 'user-1' } };

      await expect(controller.optOut('space-1', req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestOtp & confirmOtp', () => {
    it('should delegate request to otpService', async () => {
      const req = { user: { userId: 'user-1' } };
      const dto = { phoneNumber: '+1234567890' };

      const result = await controller.requestOtp('space-1', req, dto);

      expect(otpService.issueOtp).toHaveBeenCalledWith('user-1', 'space-1', '+1234567890');
      expect(result).toEqual({ success: true, message: 'Verification code sent to WhatsApp.' });
    });

    it('should delegate confirm to otpService', async () => {
      const req = { user: { userId: 'user-1' } };
      const dto = { phoneNumber: '+1234567890', code: '123456' };

      const result = await controller.confirmOtp('space-1', req, dto);

      expect(otpService.confirmOtp).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ success: true, message: 'Phone number verified successfully.' });
    });
  });

  describe('registerWebhook', () => {
    it('should return public webhook url', async () => {
      config.get.mockReturnValue('https://public.mongez.com');

      const result = await controller.registerWebhook('space-1');

      expect(result).toEqual({
        webhookUrl: 'https://public.mongez.com/api/v1/whatsapp/webhook',
        note: expect.any(String),
      });
    });
  });
});
