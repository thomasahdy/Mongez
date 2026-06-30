import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditAction } from '../constants/audit-actions.constant';
import * as crypto from 'crypto';
import { canLogSensitiveAuthLinks } from '../utils/sensitive-auth-log.util';

@Injectable()
export class EmailVerificationService {
  private readonly TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create and send email verification token (only for non-OAuth users)
   */
  async sendVerificationToken(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Skip if already verified
    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Skip if user uses OAuth
    if (user.providerId && user.providerId !== null) {
      throw new BadRequestException('OAuth users do not need email verification');
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Invalidate previous tokens
    await this.prisma.emailVerification.updateMany({
      where: { userId },
      data: { used: true },
    });

    // Create new verification token
    await this.prisma.emailVerification.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
      },
    });

    // Log the request
    await this.prisma.userLog.create({
      data: {
        userId,
        action: AuditAction.EMAIL_VERIFICATION_SENT,
      },
    });

    // TODO: Send verification email
    if (canLogSensitiveAuthLinks(this.configService)) {
      console.log(`Email verification token for ${user.email}: ${token}`);
      console.log(
        `Verification link: ${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`,
      );
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!verification) {
      return {
        success: false,
        message: 'Invalid or expired verification token',
      };
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { isVerified: true },
    });

    // Mark token as used
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    // Log the verification
    await this.prisma.userLog.create({
      data: {
        userId: verification.userId,
        action: AuditAction.EMAIL_VERIFIED,
      },
    });

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Resend verification email (only for non-OAuth users)
   */
  async resendVerification(userId: string): Promise<void> {
    await this.sendVerificationToken(userId);
  }

  /**
   * Check if user is verified
   */
  async isUserVerified(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, providerId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // OAuth users are always considered verified
    if (user.providerId) {
      return true;
    }

    return user.isVerified;
  }
}
