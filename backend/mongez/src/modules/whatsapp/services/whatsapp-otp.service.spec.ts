import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppOtpService } from './whatsapp-otp.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { HttpException, HttpStatus, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('WhatsAppOtpService', () => {
  let service: WhatsAppOtpService;
  let prisma: any;
  let whatsapp: jest.Mocked<WhatsAppService>;

  beforeEach(async () => {
    prisma = {
      whatsAppOtpCode: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      whatsAppContact: {
        upsert: jest.fn(),
      },
    };

    whatsapp = {
      resolveAccount: jest.fn(),
      sendText: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppOtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: WhatsAppService, useValue: whatsapp },
      ],
    }).compile();

    service = module.get<WhatsAppOtpService>(WhatsAppOtpService);
    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  describe('issueOtp', () => {
    it('should generate and send OTP via WhatsApp if rate limit permits', async () => {
      prisma.whatsAppOtpCode.count.mockResolvedValue(2); // < 5 in last hour
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');
      const account = { spaceId: 'space-1' } as any;
      whatsapp.resolveAccount.mockResolvedValue(account);

      await service.issueOtp('user-1', 'space-1', '+1234567890');

      expect(prisma.whatsAppOtpCode.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          phoneNumber: '+1234567890',
        }),
      }));
      expect(prisma.whatsAppOtpCode.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          spaceId: 'space-1',
          phoneNumber: '+1234567890',
          codeHash: 'hashed-code',
          attempts: 0,
        }),
      }));
      expect(whatsapp.resolveAccount).toHaveBeenCalledWith('space-1');
      expect(whatsapp.sendText).toHaveBeenCalledWith(
        account,
        '+1234567890',
        expect.stringContaining('verification code'),
        'otp_verification'
      );
    });

    it('should throw TOO_MANY_REQUESTS exception if rate limit (>= 5 OTPs/hour) is exceeded', async () => {
      prisma.whatsAppOtpCode.count.mockResolvedValue(5); // limit reached

      await expect(service.issueOtp('user-1', 'space-1', '+1234567890')).rejects.toThrow(
        new HttpException(
          'Too many OTP requests. Please wait before requesting another.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      expect(prisma.whatsAppOtpCode.create).not.toHaveBeenCalled();
      expect(whatsapp.sendText).not.toHaveBeenCalled();
    });

    it('should catch errors when sending whatsapp fails and not propagate them', async () => {
      prisma.whatsAppOtpCode.count.mockResolvedValue(0);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');
      whatsapp.resolveAccount.mockRejectedValue(new Error('Network Error'));

      // Should not throw
      await expect(service.issueOtp('user-1', 'space-1', '+1234567890')).resolves.not.toThrow();
      expect(prisma.whatsAppOtpCode.create).toHaveBeenCalled();
    });
  });

  describe('confirmOtp', () => {
    const mockOtpRecord = {
      id: 'otp-record-id',
      userId: 'user-1',
      spaceId: 'space-1',
      phoneNumber: '+1234567890',
      codeHash: 'hashed-code',
      attempts: 2,
    };

    it('should confirm OTP and mark contact as verified on successful match', async () => {
      prisma.whatsAppOtpCode.findFirst.mockResolvedValue(mockOtpRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.confirmOtp('user-1', { phoneNumber: '+1234567890', code: '123456' });

      expect(prisma.whatsAppOtpCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          phoneNumber: '+1234567890',
        }),
      }));
      expect(prisma.whatsAppOtpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-record-id' },
        data: { attempts: { increment: 1 } },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashed-code');
      expect(prisma.whatsAppContact.upsert).toHaveBeenCalledWith({
        where: {
          userId_spaceId: { userId: 'user-1', spaceId: 'space-1' },
        },
        create: {
          userId: 'user-1',
          spaceId: 'space-1',
          phoneNumber: '+1234567890',
          isVerified: true,
          optedIn: true,
        },
        update: {
          phoneNumber: '+1234567890',
          isVerified: true,
        },
      });
      expect(prisma.whatsAppOtpCode.delete).toHaveBeenCalledWith({
        where: { id: 'otp-record-id' },
      });
    });

    it('should throw NotFoundException if no active OTP found', async () => {
      prisma.whatsAppOtpCode.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmOtp('user-1', { phoneNumber: '+1234567890', code: '123456' }),
      ).rejects.toThrow(
        new NotFoundException('No active verification code found. Please request a new code.'),
      );
    });

    it('should throw ForbiddenException if too many attempts (>= 5)', async () => {
      prisma.whatsAppOtpCode.findFirst.mockResolvedValue({
        ...mockOtpRecord,
        attempts: 5,
      });

      await expect(
        service.confirmOtp('user-1', { phoneNumber: '+1234567890', code: '123456' }),
      ).rejects.toThrow(
        new ForbiddenException('Too many incorrect attempts. Please request a new code.'),
      );
    });

    it('should throw UnauthorizedException on invalid code', async () => {
      prisma.whatsAppOtpCode.findFirst.mockResolvedValue(mockOtpRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // mismatch

      await expect(
        service.confirmOtp('user-1', { phoneNumber: '+1234567890', code: 'wrong-code' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid verification code.'));

      expect(prisma.whatsAppContact.upsert).not.toHaveBeenCalled();
      expect(prisma.whatsAppOtpCode.delete).not.toHaveBeenCalled();
    });
  });
});
