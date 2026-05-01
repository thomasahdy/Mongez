import { UsersService } from './users.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { UserRepository } from './user.repository';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<UserRepository>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    userRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      updateProfile: jest.fn(),
      findByEmail: jest.fn(),
      updateLastLogin: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
    } as any;

    service = new UsersService(userRepo, cache);
  });

  describe('getProfile()', () => {
    it('UT-USER-SVC-001: should return user profile from cache/DB', async () => {
      const mockUser = { id: 'user-1', name: 'Test User' };
      cache.getOrSet.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(mockUser);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        'user:user-1',
        expect.any(Function),
        300,
      );
    });

    it('UT-USER-SVC-002: should throw NotFoundException for missing user', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      userRepo.findById.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
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

  describe('getUsersByIds()', () => {
    it('should return users matching given IDs', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ];
      userRepo.findByIds.mockResolvedValue(mockUsers as any);

      const result = await service.getUsersByIds(['user-1', 'user-2']);

      expect(result).toEqual(mockUsers);
      expect(userRepo.findByIds).toHaveBeenCalledWith(['user-1', 'user-2']);
    });
  });
});