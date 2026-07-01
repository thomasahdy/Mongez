import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PasswordService } from '../auth/services/password.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { UserRepository } from './repositories/user.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { paginate } from '../../shared/dto/pagination.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly CACHE_PREFIX = 'user';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CacheService,
    private readonly passwordService: PasswordService,
    private readonly storage: StorageService,
  ) {}

  async getById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}`,
      async () => {
        const user = await this.userRepo.findById(id);
        if (!user) throw new NotFoundException('User not found');
        return this.withPublicAvatarUrl(user);
      },
      this.CACHE_TTL,
    );
  }

  async getAll(page: number, limit: number) {
    const { data, total } = await this.userRepo.findAll(page, limit);
    const users = await Promise.all(data.map((user) => this.withPublicAvatarUrl(user)));
    return paginate(users, total, page, limit);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const payload: Omit<UpdateProfileDto, 'avatarUrl'> & { avatarUrl?: string | null } = {
      ...dto,
      ...(dto.avatarUrl === '' ? { avatarUrl: null } : {}),
    };
    const user = await this.userRepo.updateProfile(id, payload);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return this.withPublicAvatarUrl(user);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const record = await this.userRepo.findWithPasswordHash(id);
    if (!record?.passwordHash) {
      throw new BadRequestException('Cannot change password for OAuth accounts');
    }

    const valid = await this.passwordService.compare(dto.currentPassword, record.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const same = await this.passwordService.compare(dto.newPassword, record.passwordHash);
    if (same) throw new BadRequestException('New password must differ from current password');

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.userRepo.updatePassword(id, newHash);
    // Revoke all sessions — forces re-login on all devices
    await this.userRepo.revokeAllSessions(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }

  async updateStatus(targetId: string, requesterId: string, dto: UpdateStatusDto) {
    if (targetId === requesterId) {
      throw new ForbiddenException('You cannot change your own account status');
    }
    const user = await this.userRepo.updateStatus(targetId, dto.status);
    if (dto.status === UserStatus.SUSPENDED) {
      await this.userRepo.revokeAllSessions(targetId);
    }
    await this.cache.invalidateEntity(this.CACHE_PREFIX, targetId);
    return this.withPublicAvatarUrl(user);
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const token = randomUUID();
    await this.userRepo.setVerificationToken(userId, token);
    // Email queuing handled in Phase 5 (MailerService + SEND_EMAIL job)
    // For now, the token is stored; link: /api/v1/users/verify-email?token={token}
  }

  async verifyEmail(token: string) {
    try {
      const user = await this.userRepo.verifyEmail(token);
      await this.cache.invalidateEntity(this.CACHE_PREFIX, user.id);
      return this.withPublicAvatarUrl(user);
    } catch {
      throw new NotFoundException('Invalid or expired verification token');
    }
  }

  /**
   * Upload avatar to storage and update user profile.
   */
  async uploadAvatar(userId: string, file: { buffer: Buffer; mimeType: string; originalName: string }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No avatar file content provided');
    }
    // Validate image MIME type
    if (!file.mimeType.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    if (file.buffer.length > 5 * 1024 * 1024) {
      // 5MB limit for avatars
      throw new BadRequestException('Avatar image must be under 5MB');
    }

    const ext = this.getSafeAvatarExtension(file.originalName, file.mimeType);
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;

    const result = await this.storage.upload(key, file.buffer, file.mimeType);
    const user = await this.userRepo.updateAvatar(userId, result.key);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, userId);
    return this.withPublicAvatarUrl(user);
  }

  /**
   * GDPR-compliant soft-delete: anonymize PII, revoke sessions.
   */
  async deleteOwnAccount(userId: string): Promise<void> {
    const anonymizedEmail = `deleted+${userId}@anon.mongez.local`;

    await this.userRepo.anonymizeAndDelete(userId, anonymizedEmail);
    await this.userRepo.revokeAllSessions(userId);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, userId);

    this.logger.log(`User ${userId} deleted their account (PII anonymized)`);
  }

  /**
   * Get notification preferences for current user.
   */
  async getNotificationPreferences(userId: string) {
    const pref = await this.userRepo.getNotificationPreferences(userId);
    return (
      pref ?? {
        userId,
        preferences: {},
        quietHours: null,
      }
    );
  }

  /**
   * Update notification preferences for current user.
   */
  async updateNotificationPreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const pref = await this.userRepo.upsertNotificationPreferences(
      userId,
      dto.preferences,
      dto.quietHours,
    );
    await this.cache.invalidateEntity(this.CACHE_PREFIX, userId);
    return pref;
  }

  async getPreferences(userId: string) {
    let pref = await this.userRepo.getPreferences(userId);
    if (!pref) {
      // Return defaults if not set in DB yet
      pref = {
        id: '',
        userId,
        language: 'en',
        timezone: 'UTC',
        theme: 'system',
        dateFormat: 'DD/MM/YYYY',
        weekStart: 'MON',
        calendarType: 'GREGORIAN',
        holidayCountry: 'EG',
        updatedAt: new Date(),
      };

    }
    return pref;
  }

  async updatePreferences(userId: string, dto: import('./dto/update-preference.dto').UpdatePreferenceDto) {
    const pref = await this.userRepo.updatePreferences(userId, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, userId);
    return pref;
  }

  private async withPublicAvatarUrl<T extends { avatarUrl?: string | null }>(user: T): Promise<T> {
    if (!user?.avatarUrl || !this.isStoredAvatarKey(user.avatarUrl)) {
      return user;
    }

    return {
      ...user,
      avatarUrl: await this.storage.getSignedUrl(user.avatarUrl, 3600),
    };
  }

  private isStoredAvatarKey(value: string): boolean {
    return value.startsWith('avatars/');
  }

  private getSafeAvatarExtension(originalName: string, mimeType: string): string {
    const extension = originalName.split('.').pop()?.toLowerCase();
    if (extension && /^[a-z0-9]+$/.test(extension)) {
      return extension;
    }

    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/svg+xml') return 'svg';
    return 'png';
  }
}
