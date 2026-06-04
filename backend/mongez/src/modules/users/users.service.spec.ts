import { UsersService } from './users.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UserRepository } from './repositories/user.repository';
import { PasswordService } from '../auth/services/password.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<UserRepository>;
  let cache: jest.Mocked<CacheService>;
  let passwordService: jest.Mocked<PasswordService>;

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
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    passwordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as any;

    service = new UsersService(userRepo, cache, passwordService);
  });

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

  describe('updateProfile()', () => {
    it('should update profile and invalidate cache', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedUser = { id: 'user-1', name: 'Updated Name' };
      userRepo.updateProfile.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('user-1', updateData);

      expect(result).toEqual(updatedUser);
      expect(userRepo.updateProfile).toHaveBeenCalledWith('user-1', updateData);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('user', 'user-1');
    });
  });
});