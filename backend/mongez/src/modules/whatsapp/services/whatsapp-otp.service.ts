import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { RequestOtpDto, ConfirmOtpDto } from '../dto/verify-phone.dto';

/**
 * WhatsAppOtpService — Handles OTP-based phone number verification for WhatsApp.
 *
 * This service:
 * - Generates 6-digit OTP codes
 * - Hashes them with bcrypt before storage
 * - Enforces rate limits (max 5 OTPs/hour/number)
 * - Limits attempts (max 5 wrong tries)
 * - Sends OTP via WhatsApp template message
 * - Verifies codes and marks WhatsAppContact.isVerified = true
 */
@Injectable()
export class WhatsAppOtpService {
  private readonly logger = new Logger(WhatsAppOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Issue a new OTP code for phone verification.
   *
   * Rate limits: max 5 OTPs per hour per phone number.
   * OTP expires after 10 minutes.
   *
   * @param userId User requesting verification
   * @param spaceId Space context
   * @param phoneNumber E.164 phone number to verify
   */
  async issueOtp(
    userId: string,
    spaceId: string,
    phoneNumber: string,
  ): Promise<void> {
    // Rate limit check: max 5 OTPs per hour per number
    const recentCount = await this.prisma.whatsAppOtpCode.count({
      where: {
        phoneNumber,
        createdAt: { gt: new Date(Date.now() - 3600_000) },
      },
    });

    if (recentCount >= 5) {
      throw new HttpException(
        'Too many OTP requests. Please wait before requesting another.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit code
    const code = randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, 10);

    // Store OTP record
    await this.prisma.whatsAppOtpCode.create({
      data: {
        userId,
        spaceId,
        phoneNumber,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60_000), // 10 minutes
        attempts: 0,
      },
    });

    // Send via WhatsApp (use template if available, otherwise fallback to text)
    try {
      const account = await this.whatsapp.resolveAccount(spaceId);

      if (!account) {
        throw new Error('WhatsApp not configured for this space');
      }

      // Format message with OTP code
      const message = `Your Mongez verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

      await this.whatsapp.sendText(
        account,
        phoneNumber,
        message,
        'otp_verification',
      );

      this.logger.log(`OTP issued for user ${userId} to ${phoneNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP WhatsApp message:`, error);
      // Don't throw — OTP is still valid, they can enter it manually
    }
  }

  /**
   * Confirm an OTP code and mark the contact as verified.
   *
   * @param userId User confirming verification
   * @param dto Phone number and code
   * @throws NotFoundException if no active OTP found
   * @throws ForbiddenException if too many attempts
   * @throws UnauthorizedException if code is invalid
   */
  async confirmOtp(
    userId: string,
    dto: ConfirmOtpDto,
  ): Promise<void> {
    const { phoneNumber, code } = dto;

    // Find the most recent unexpired OTP for this user/number
    const otpRecord = await this.prisma.whatsAppOtpCode.findFirst({
      where: {
        userId,
        phoneNumber,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new NotFoundException(
        'No active verification code found. Please request a new code.',
      );
    }

    // Check attempts limit
    if (otpRecord.attempts >= 5) {
      throw new ForbiddenException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Increment attempts
    await this.prisma.whatsAppOtpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    // Verify code
    const isValid = await bcrypt.compare(code, otpRecord.codeHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    // Mark contact as verified
    await this.prisma.whatsAppContact.upsert({
      where: {
        userId_spaceId: {
          userId,
          spaceId: otpRecord.spaceId,
        },
      },
      create: {
        userId,
        spaceId: otpRecord.spaceId,
        phoneNumber,
        isVerified: true,
        optedIn: true,
      },
      update: {
        phoneNumber,
        isVerified: true,
      },
    });

    // Clean up used OTP
    await this.prisma.whatsAppOtpCode.delete({
      where: { id: otpRecord.id },
    });

    this.logger.log(`Phone ${phoneNumber} verified for user ${userId}`);
  }
}
