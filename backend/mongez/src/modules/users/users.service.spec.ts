import { UsersService } from './users.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UserRepository } from './repositories/user.repository';
import { PasswordService } from '../auth/services/password.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: any;
  let cache: jest.Mocked<CacheService>;
  let passwordService: jest.Mocked<PasswordService>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      findWithPasswordHash: jest.fn(),
      updateProfile: jest.fn(),
      updatePassword: jest.fn(),
      updateStatus: jest.fn(),
      setVerificationToken: jest.fn(),
      verifyEmail: jest.fn(),
      revokeAllSessions: jest.fn(),
      updateAvatar: jest.fn(),
      anonymizeAndDelete: jest.fn(),
      getNotificationPreferences: jest.fn(),
      upsertNotificationPreferences: jest.fn(),
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
    };

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    passwordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any;

    storageService = {
      upload: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new UsersService(
      userRepo as UserRepository,
      cache,
      passwordService as PasswordService,
      storageService as StorageService,
    );
  });

  // ─── getById() ───────────────────────────────────────────────

  describe('getById()', () => {
    it('UT-USER-SVC-001: should return user profile from cache/DB', async () => {
      const mockUser = { id: 'user-1', name: 'Test User' };
      cache.getOrSet.mockResolvedValue(mockUser);

      const result = await service.getById('user-1');

      expect(result).toEqual(mockUser);
      expect(cache.getOrSet).toHaveBeenCalledWith('user:user-1', expect.any(Function), 300);
    });

    it('UT-USER-SVC-002: should throw NotFoundException for missing user', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      userRepo.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateProfile() ─────────────────────────────────────────

  describe('updateProfile()', () => {
    it('should update profile and invalidate cache', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedUser = { id: 'user-1', name: 'Updated Name' };
      userRepo.updateProfile.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', updateData);

      expect(result).toEqual(updatedUser);
      expect(userRepo.updateProfile).toHaveBeenCalledWith('user-1', updateData);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });

    it('should normalize empty avatarUrl to null when removing avatar', async () => {
      const updatedUser = { id: 'user-1', avatarUrl: null };
      userRepo.updateProfile.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', { avatarUrl: '' });

      expect(result).toEqual(updatedUser);
      expect(userRepo.updateProfile).toHaveBeenCalledWith('user-1', { avatarUrl: null });
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });
  });

  // ─── changePassword() ────────────────────────────────────────

  describe('changePassword()', () => {
    it('UT-USER-PASS-001: should throw BadRequestException if OAuth account', async () => {
      userRepo.findWithPasswordHash.mockResolvedValue({ id: 'user-1', passwordHash: null });

      await expect(
        service.changePassword('user-1', { currentPassword: 'Old', newPassword: 'New' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-USER-PASS-002: should throw UnauthorizedException if current password is incorrect', async () => {
      userRepo.findWithPasswordHash.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-old' });
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', { currentPassword: 'WrongOld', newPassword: 'New' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('UT-USER-PASS-003: should throw BadRequestException if new password matches old', async () => {
      userRepo.findWithPasswordHash.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-old' });
      passwordService.compare.mockImplementation(async (pw, hash) => {
        if (pw === 'OldPassword' && hash === 'hash-old') return true;
        if (pw === 'OldPassword') return true; // matches current
        return false;
      });

      await expect(
        service.changePassword('user-1', { currentPassword: 'OldPassword', newPassword: 'OldPassword' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-USER-PASS-004: should update password, revoke all sessions, and invalidate cache', async () => {
      userRepo.findWithPasswordHash.mockResolvedValue({ id: 'user-1', passwordHash: 'hash-old' });
      passwordService.compare.mockImplementation(async (pw, hash) => {
        if (pw === 'OldPassword' && hash === 'hash-old') return true;
        if (pw === 'NewPassword' && hash === 'hash-old') return false;
        return false;
      });
      passwordService.hash.mockResolvedValue('hash-new');
      userRepo.updatePassword.mockResolvedValue({});
      userRepo.revokeAllSessions.mockResolvedValue({});

      await service.changePassword('user-1', { currentPassword: 'OldPassword', newPassword: 'NewPassword' });

      expect(passwordService.hash).toHaveBeenCalledWith('NewPassword');
      expect(userRepo.updatePassword).toHaveBeenCalledWith('user-1', 'hash-new');
      expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('user-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });
  });

  // ─── updateStatus() ──────────────────────────────────────────

  describe('updateStatus()', () => {
    it('UT-USER-STATUS-001: should throw ForbiddenException when updating self', async () => {
      await expect(
        service.updateStatus('user-1', 'user-1', { status: UserStatus.SUSPENDED }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('UT-USER-STATUS-002: should update status and invalidate cache', async () => {
      const mockUpdatedUser = { id: 'user-2', status: UserStatus.ACTIVE };
      userRepo.updateStatus.mockResolvedValue(mockUpdatedUser);

      const result = await service.updateStatus('user-2', 'user-1', { status: UserStatus.ACTIVE });

      expect(result).toEqual(mockUpdatedUser);
      expect(userRepo.updateStatus).toHaveBeenCalledWith('user-2', UserStatus.ACTIVE);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-2');
    });

    it('UT-USER-STATUS-003: should revoke all sessions if suspended', async () => {
      const mockUpdatedUser = { id: 'user-2', status: UserStatus.SUSPENDED };
      userRepo.updateStatus.mockResolvedValue(mockUpdatedUser);
      userRepo.revokeAllSessions.mockResolvedValue({});

      await service.updateStatus('user-2', 'user-1', { status: UserStatus.SUSPENDED });

      expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('user-2');
    });
  });

  // ─── verifyEmail() ───────────────────────────────────────────

  describe('verifyEmail()', () => {
    it('UT-USER-VER-001: should send verification email by storing token', async () => {
      userRepo.setVerificationToken.mockResolvedValue({});

      await service.sendVerificationEmail('user-1');

      expect(userRepo.setVerificationToken).toHaveBeenCalledWith('user-1', expect.any(String));
    });

    it('UT-USER-VER-002: should verify email with token and invalidate cache', async () => {
      const mockUser = { id: 'user-1', isVerified: true };
      userRepo.verifyEmail.mockResolvedValue(mockUser);

      const result = await service.verifyEmail('token-123');

      expect(result).toEqual(mockUser);
      expect(userRepo.verifyEmail).toHaveBeenCalledWith('token-123');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });

    it('UT-USER-VER-003: should throw NotFoundException on verify fail', async () => {
      userRepo.verifyEmail.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadAvatar() ──────────────────────────────────────────

  describe('uploadAvatar()', () => {
    it('UT-USER-AVATAR-000: should throw BadRequestException if file content is missing', async () => {
      await expect(
        service.uploadAvatar('user-1', {
          buffer: Buffer.alloc(0),
          mimeType: 'image/jpeg',
          originalName: 'avatar.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-USER-AVATAR-001: should throw BadRequestException if file is not an image MIME type', async () => {
      await expect(
        service.uploadAvatar('user-1', {
          buffer: Buffer.from('hello'),
          mimeType: 'text/plain',
          originalName: 'test.txt',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-USER-AVATAR-002: should throw BadRequestException if file size exceeds 5MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await expect(
        service.uploadAvatar('user-1', {
          buffer: largeBuffer,
          mimeType: 'image/jpeg',
          originalName: 'avatar.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-USER-AVATAR-003: should upload avatar successfully and invalidate cache', async () => {
      storageService.upload.mockResolvedValue({ key: 'avatars/user-1/uuid.jpg' } as any);
      userRepo.updateAvatar.mockResolvedValue({ id: 'user-1', avatar: 'avatars/user-1/uuid.jpg' });

      const result = await service.uploadAvatar('user-1', {
        buffer: Buffer.from('image-data'),
        mimeType: 'image/jpeg',
        originalName: 'profile.jpg',
      });

      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringContaining('avatars/user-1/'),
        expect.any(Buffer),
        'image/jpeg',
      );
      expect(userRepo.updateAvatar).toHaveBeenCalledWith('user-1', 'avatars/user-1/uuid.jpg');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
      expect(result.avatar).toBe('avatars/user-1/uuid.jpg');
    });
  });

  // ─── deleteOwnAccount() ──────────────────────────────────────

  describe('deleteOwnAccount()', () => {
    it('UT-USER-DEL-001: should anonymize PII, revoke sessions, and invalidate cache', async () => {
      userRepo.anonymizeAndDelete.mockResolvedValue({});
      userRepo.revokeAllSessions.mockResolvedValue({});

      await service.deleteOwnAccount('user-1');

      expect(userRepo.anonymizeAndDelete).toHaveBeenCalledWith(
        'user-1',
        expect.stringContaining('deleted+user-1@anon.mongez.local'),
      );
      expect(userRepo.revokeAllSessions).toHaveBeenCalledWith('user-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });
  });

  // ─── Notification Preferences ───────────────────────────────

  describe('getNotificationPreferences()', () => {
    it('should return preferences from DB if found', async () => {
      const mockPref = { userId: 'user-1', preferences: { email: true }, quietHours: null };
      userRepo.getNotificationPreferences.mockResolvedValue(mockPref);

      const result = await service.getNotificationPreferences('user-1');

      expect(result).toEqual(mockPref);
    });

    it('should return default preferences if none in DB', async () => {
      userRepo.getNotificationPreferences.mockResolvedValue(null);

      const result = await service.getNotificationPreferences('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        preferences: {},
        quietHours: null,
      });
    });
  });

  describe('updateNotificationPreferences()', () => {
    it('should upsert preferences and invalidate cache', async () => {
      const dto = { preferences: { email: false }, quietHours: '22:00-08:00' };
      const mockPref = { userId: 'user-1', ...dto };
      userRepo.upsertNotificationPreferences.mockResolvedValue(mockPref);

      const result = await service.updateNotificationPreferences('user-1', dto);

      expect(userRepo.upsertNotificationPreferences).toHaveBeenCalledWith('user-1', dto.preferences, dto.quietHours);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
      expect(result).toEqual(mockPref);
    });
  });

  // ─── Preferences ─────────────────────────────────────────────

  describe('getPreferences()', () => {
    it('should return user preferences if they exist', async () => {
      const mockPref = { id: 'p-1', userId: 'user-1', language: 'fr', timezone: 'EST', theme: 'dark', dateFormat: 'YYYY-MM-DD', weekStart: 'SUN' };
      userRepo.getPreferences.mockResolvedValue(mockPref);

      const result = await service.getPreferences('user-1');
      expect(result).toEqual(mockPref);
    });

    it('should return default preferences if none exist in DB', async () => {
      userRepo.getPreferences.mockResolvedValue(null);

      const result = await service.getPreferences('user-1');
      expect(result.userId).toBe('user-1');
      expect(result.language).toBe('en');
      expect(result.theme).toBe('system');
    });
  });

  describe('updatePreferences()', () => {
    it('should update preferences and invalidate cache', async () => {
      const dto = { language: 'ar', theme: 'light' };
      const mockUpdatedPref = { id: 'p-1', userId: 'user-1', ...dto };
      userRepo.updatePreferences.mockResolvedValue(mockUpdatedPref);

      const result = await service.updatePreferences('user-1', dto as any);
      expect(result).toEqual(mockUpdatedPref);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });
  });
});
