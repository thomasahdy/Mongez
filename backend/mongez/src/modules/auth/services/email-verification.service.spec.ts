import { EmailVerificationService } from './email-verification.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditAction } from '../constants/audit-actions.constant';
import * as crypto from 'crypto';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: any;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      emailVerification: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      userLog: {
        create: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as any;

    service = new EmailVerificationService(
      prisma as PrismaService,
      configService as ConfigService,
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // sendVerificationToken
  // ═══════════════════════════════════════════════════════════════

  describe('sendVerificationToken()', () => {
    it('UT-EMAIL-SEND-001: should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sendVerificationToken('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('UT-EMAIL-SEND-002: should throw BadRequestException if user is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isVerified: true,
      });

      await expect(service.sendVerificationToken('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.sendVerificationToken('user-1')).rejects.toThrow(
        'Email is already verified',
      );
    });

    it('UT-EMAIL-SEND-003: should throw BadRequestException if user uses OAuth', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isVerified: false,
        providerId: 'google',
      });

      await expect(service.sendVerificationToken('user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.sendVerificationToken('user-1')).rejects.toThrow(
        'OAuth users do not need email verification',
      );
    });

    it('UT-EMAIL-SEND-004: should invalidate previous tokens and create a new verification token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isVerified: false,
        providerId: null,
      });

      prisma.emailVerification.updateMany.mockResolvedValue({ count: 1 });
      prisma.emailVerification.create.mockResolvedValue({ id: 'verification-1' });
      prisma.userLog.create.mockResolvedValue({});

      await service.sendVerificationToken('user-1');

      expect(prisma.emailVerification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { used: true },
      });

      expect(prisma.emailVerification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });

      // Verify expiresAt is set to ~24 hours in the future
      const expiresAt = prisma.emailVerification.create.mock.calls[0][0].data.expiresAt;
      const difference = expiresAt.getTime() - Date.now();
      expect(difference).toBeGreaterThan(23.9 * 60 * 60 * 1000); // close to 24h
      expect(difference).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('UT-EMAIL-SEND-005: should log the action in userLog', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isVerified: false,
        providerId: null,
      });

      await service.sendVerificationToken('user-1');

      expect(prisma.userLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: AuditAction.EMAIL_VERIFICATION_SENT,
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // verifyEmail
  // ═══════════════════════════════════════════════════════════════

  describe('verifyEmail()', () => {
    it('UT-EMAIL-VER-001: should return success: false if token does not match any active non-expired record', async () => {
      prisma.emailVerification.findFirst.mockResolvedValue(null);

      const result = await service.verifyEmail('invalid-token');

      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired verification token',
      });
    });

    it('UT-EMAIL-VER-002: should update user as verified, mark token as used, and log the action', async () => {
      const mockVerification = {
        id: 'ver-1',
        userId: 'user-1',
        user: { id: 'user-1', email: 'test@example.com' },
      };
      prisma.emailVerification.findFirst.mockResolvedValue(mockVerification);
      prisma.user.update.mockResolvedValue({ id: 'user-1', isVerified: true });
      prisma.emailVerification.update.mockResolvedValue({});
      prisma.userLog.create.mockResolvedValue({});

      const rawToken = 'my-verification-token';
      const result = await service.verifyEmail(rawToken);

      expect(result).toEqual({
        success: true,
        message: 'Email verified successfully',
      });

      // Verify the query hashed the raw token using SHA256
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(prisma.emailVerification.findFirst).toHaveBeenCalledWith({
        where: {
          token: hashedToken,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          user: true,
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isVerified: true },
      });

      expect(prisma.emailVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-1' },
        data: { used: true },
      });

      expect(prisma.userLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: AuditAction.EMAIL_VERIFIED,
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // resendVerification
  // ═══════════════════════════════════════════════════════════════

  describe('resendVerification()', () => {
    it('UT-EMAIL-RES-001: should call sendVerificationToken under the hood', async () => {
      const spy = jest.spyOn(service, 'sendVerificationToken').mockResolvedValue(undefined);

      await service.resendVerification('user-1');

      expect(spy).toHaveBeenCalledWith('user-1');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // isUserVerified
  // ═══════════════════════════════════════════════════════════════

  describe('isUserVerified()', () => {
    it('UT-EMAIL-ISVER-001: should return true if user is OAuth user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isVerified: false,
        providerId: 'google',
      });

      const result = await service.isUserVerified('user-1');

      expect(result).toBe(true);
    });

    it('UT-EMAIL-ISVER-002: should return verified status if user is non-OAuth', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isVerified: true,
        providerId: null,
      });

      const result1 = await service.isUserVerified('user-1');
      expect(result1).toBe(true);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        isVerified: false,
        providerId: null,
      });

      const result2 = await service.isUserVerified('user-2');
      expect(result2).toBe(false);
    });

    it('UT-EMAIL-ISVER-003: should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.isUserVerified('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
