import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from './password.service';
import { AuditAction } from '../constants/audit-actions.constant';
import * as crypto from 'crypto';
import { canLogSensitiveAuthLinks } from '../utils/sensitive-auth-log.util';

@Injectable()
export class PasswordResetService {
  private readonly TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly MAX_ATTEMPTS = 3;
  private readonly LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initiate password reset flow (only for non-OAuth users)
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists to prevent email enumeration
      return;
    }

    // Check if user uses OAuth (can't reset password)
    if (user.providerId && user.providerId !== null) {
      throw new ConflictException(
        'This account uses OAuth authentication. Please log in with your OAuth provider.',
      );
    }

    // Check if rate-limited
    const recentRequest = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (recentRequest && recentRequest.attempts >= this.MAX_ATTEMPTS) {
      const cooldownEnd = new Date(recentRequest.expiresAt.getTime() + this.LOCK_DURATION);
      if (new Date() < cooldownEnd) {
        throw new BadRequestException(
          `Too many reset attempts. Please try again after ${Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)} minutes.`,
        );
      }
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Invalidate previous tokens
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new reset token
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
        attempts: 0,
      },
    });

    // Log the request
    await this.prisma.userLog.create({
      data: {
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUEST,
      },
    });

    // TODO: Send email with reset link
    if (canLogSensitiveAuthLinks(this.configService)) {
      this.logger.log(`Password reset token for ${email}: ${token}`);
      this.logger.log(
        `Reset link: ${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`,
      );
    }
  }

  /**
   * Verify reset token
   */
  async verifyResetToken(token: string): Promise<{ userId: string; email: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRequest = await this.prisma.passwordReset.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!resetRequest) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { userId: resetRequest.user.id, email: resetRequest.user.email };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRequest = await this.prisma.passwordReset.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetRequest) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Validate new password
    if (!this.passwordService.validatePassword(newPassword)) {
      throw new BadRequestException(
        `Password does not meet requirements: ${this.passwordService.getPasswordRequirements()}`,
      );
    }

    const hashedPassword = await this.passwordService.hash(newPassword);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetRequest.userId },
      data: {
        passwordHash: hashedPassword,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Mark token as used
    await this.prisma.passwordReset.update({
      where: { id: resetRequest.id },
      data: { used: true },
    });

    // Revoke all sessions for security
    await this.prisma.userSession.deleteMany({
      where: { userId: resetRequest.userId },
    });

    // Log the password reset
    await this.prisma.userLog.create({
      data: {
        userId: resetRequest.userId,
        action: AuditAction.PASSWORD_RESET_COMPLETE,
      },
    });
  }

  /**
   * Invalidate all reset tokens for a user
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await this.prisma.passwordReset.updateMany({
      where: { userId },
      data: { used: true },
    });
  }
}
