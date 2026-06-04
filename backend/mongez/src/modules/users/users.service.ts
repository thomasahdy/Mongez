import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PasswordService } from '../auth/services/password.service';
import { UserRepository } from './repositories/user.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { paginate } from '../../shared/dto/pagination.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  private readonly CACHE_PREFIX = 'user';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CacheService,
    private readonly passwordService: PasswordService,
  ) {}

  async getById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}`,
      async () => {
        const user = await this.userRepo.findById(id);
        if (!user) throw new NotFoundException('User not found');
        return user;
      },
      this.CACHE_TTL,
    );
  }

  async getAll(page: number, limit: number) {
    const { data, total } = await this.userRepo.findAll(page, limit);
    return paginate(data, total, page, limit);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.updateProfile(id, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return user;
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
    return user;
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
      return user;
    } catch {
      throw new NotFoundException('Invalid or expired verification token');
    }
  }
}