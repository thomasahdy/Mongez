import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditAction } from '../constants/audit-actions.constant';
import * as crypto from 'crypto';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: any;
  let passwordService: jest.Mocked<PasswordService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordReset: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userSession: {
        deleteMany: jest.fn(),
      },
      userLog: {
        create: jest.fn(),
      },
    };

    passwordService = {
      validatePassword: jest.fn().mockReturnValue(true),
      getPasswordRequirements: jest.fn().mockReturnValue('Mocked requirements'),
      hash: jest.fn().mockResolvedValue('mocked-hashed-password'),
    } as any;

    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as any;

    service = new PasswordResetService(
      prisma as PrismaService,
      passwordService as PasswordService,
      configService as ConfigService,
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // requestPasswordReset
  // ═══════════════════════════════════════════════════════════════

  describe('requestPasswordReset()', () => {
    it('UT-PASS-REQ-001: should return silently if user not found to prevent email enumeration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.requestPasswordReset('nonexistent@example.com')).resolves.toBeUndefined();
      expect(prisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('UT-PASS-REQ-002: should throw ConflictException if user uses OAuth', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'oauth@example.com',
        providerId: 'google',
      });

      await expect(service.requestPasswordReset('oauth@example.com')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.requestPasswordReset('oauth@example.com')).rejects.toThrow(
        'This account uses OAuth authentication',
      );
    });

    it('UT-PASS-REQ-003: should throw BadRequestException if rate-limited (too many attempts)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        providerId: null,
      });

      // 3 attempts and is not expired yet
      prisma.passwordReset.findFirst.mockResolvedValue({
        userId: 'user-1',
        attempts: 3,
        expiresAt: new Date(Date.now() + 300000), // expires in 5 mins
      });

      await expect(service.requestPasswordReset('test@example.com')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.requestPasswordReset('test@example.com')).rejects.toThrow(
        'Too many reset attempts',
      );
    });

    it('UT-PASS-REQ-004: should invalidate previous tokens and create a new reset token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        providerId: null,
      });

      prisma.passwordReset.findFirst.mockResolvedValue(null); // No recent request

      await service.requestPasswordReset('test@example.com');

      expect(prisma.passwordReset.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', used: false },
        data: { used: true },
      });

      expect(prisma.passwordReset.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
          attempts: 0,
        },
      });

      // Verify expiration is set (~1 hour)
      const expiresAt = prisma.passwordReset.create.mock.calls[0][0].data.expiresAt;
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(59.9 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('UT-PASS-REQ-005: should log the password reset request in userLog', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        providerId: null,
      });
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await service.requestPasswordReset('test@example.com');

      expect(prisma.userLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: AuditAction.PASSWORD_RESET_REQUEST,
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // verifyResetToken
  // ═══════════════════════════════════════════════════════════════

  describe('verifyResetToken()', () => {
    it('UT-PASS-VER-001: should throw BadRequestException if reset token is invalid, used, or expired', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(service.verifyResetToken('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyResetToken('invalid-token')).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });

    it('UT-PASS-VER-002: should return user information if reset token is valid', async () => {
      const mockReset = {
        userId: 'user-1',
        user: { id: 'user-1', email: 'test@example.com' },
      };
      prisma.passwordReset.findFirst.mockResolvedValue(mockReset);

      const rawToken = 'valid-token';
      const result = await service.verifyResetToken(rawToken);

      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(prisma.passwordReset.findFirst).toHaveBeenCalledWith({
        where: {
          token: hashedToken,
          used: false,
          expiresAt: { gt: expect.any(Date) },
        },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      });

      expect(result).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // resetPassword
  // ═══════════════════════════════════════════════════════════════

  describe('resetPassword()', () => {
    it('UT-PASS-RES-001: should throw BadRequestException if token is invalid or expired', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'NewPassword123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('UT-PASS-RES-002: should throw BadRequestException if new password fails validation', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
      });

      passwordService.validatePassword.mockReturnValue(false);

      await expect(service.resetPassword('valid-token', 'weak')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword('valid-token', 'weak')).rejects.toThrow(
        'Password does not meet requirements',
      );
    });

    it('UT-PASS-RES-003: should update user password, mark token as used, revoke sessions, and log the action', async () => {
      prisma.passwordReset.findFirst.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
      });

      await service.resetPassword('valid-token', 'ValidNewPassword123');

      expect(passwordService.hash).toHaveBeenCalledWith('ValidNewPassword123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'mocked-hashed-password',
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      expect(prisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: 'reset-1' },
        data: { used: true },
      });

      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });

      expect(prisma.userLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: AuditAction.PASSWORD_RESET_COMPLETE,
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // invalidateUserTokens
  // ═══════════════════════════════════════════════════════════════

  describe('invalidateUserTokens()', () => {
    it('UT-PASS-INV-001: should mark all user reset tokens as used', async () => {
      await service.invalidateUserTokens('user-1');

      expect(prisma.passwordReset.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { used: true },
      });
    });
  });
});
