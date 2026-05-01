import { User } from './user.entity';

// Mock @prisma/client to provide UserStatus enum
jest.mock('@prisma/client', () => ({
  UserStatus: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    INVITED: 'INVITED',
    SUSPENDED: 'SUSPENDED',
  },
}));

// Mock crypto to control UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('User Entity', () => {
  describe('User.create()', () => {
    it('UT-USER-001: should create user with valid data, ACTIVE status, isVerified=false', () => {
      const user = User.create('test@example.com', 'hashedpassword', 'Test User');

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('test@example.com');
      expect(user.password).toBe('hashedpassword');
      expect(user.name).toBe('Test User');
      expect(user.status).toBe('ACTIVE');
      expect(user.isVerified).toBe(false);
      expect(user.failedAttempts).toBe(0);
      expect(user.id).toBe('test-uuid-123');
    });

    it('UT-USER-002: should default name to empty string when not provided', () => {
      const user = User.create('test@example.com', 'hashedpassword');

      expect(user.name).toBe('');
    });

    it('UT-USER-003: should set createdAt and updatedAt on creation', () => {
      const before = new Date();
      const user = User.create('test@example.com', 'hashedpassword', 'Test');
      const after = new Date();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('User.createOAuthUser()', () => {
    it('should create OAuth user with verified email', () => {
      const user = User.createOAuthUser(
        'oauth@example.com',
        'OAuth User',
        'google',
        'google-123',
        'https://avatar.url/pic.jpg',
      );

      expect(user.email).toBe('oauth@example.com');
      expect(user.name).toBe('OAuth User');
      expect(user.provider).toBe('google');
      expect(user.providerId).toBe('google-123');
      expect(user.avatarUrl).toBe('https://avatar.url/pic.jpg');
      expect(user.isVerified).toBe(true);
      expect(user.status).toBe('ACTIVE');
    });

    it('should create OAuth user without avatar', () => {
      const user = User.createOAuthUser('oauth@example.com', 'OAuth User', 'google', 'google-123');

      expect(user.avatarUrl).toBeUndefined();
    });
  });

  describe('user.isLocked', () => {
    it('UT-USER-003: should return true when lockedUntil is in the future', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      (user as any)._lockedUntil = new Date(Date.now() + 30 * 60 * 1000);

      expect(user.isLocked).toBe(true);
    });

    it('UT-USER-004: should return false when lockedUntil is in the past', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      (user as any)._lockedUntil = new Date(Date.now() - 60 * 1000);

      expect(user.isLocked).toBe(false);
    });

    it('UT-USER-005: should return false when lockedUntil is null', () => {
      const user = User.create('test@example.com', 'pass', 'Test');

      expect(user.isLocked).toBe(false);
    });
  });

  describe('user.incrementFailedAttempts()', () => {
    it('UT-USER-006: should increment failed attempts by 1', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      (user as any)._failedAttempts = 3;

      user.incrementFailedAttempts();

      expect(user.failedAttempts).toBe(4);
    });

    it('should update updatedAt timestamp', async () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      const beforeUpdate = user.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      user.incrementFailedAttempts();

      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('user.resetFailedAttempts()', () => {
    it('UT-USER-007: should reset failed attempts to 0', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      (user as any)._failedAttempts = 5;

      user.resetFailedAttempts();

      expect(user.failedAttempts).toBe(0);
    });

    it('should clear lockedUntil', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      (user as any)._lockedUntil = new Date(Date.now() + 30000);

      user.resetFailedAttempts();

      expect(user.lockedUntil).toBeUndefined();
    });
  });

  describe('user.lock()', () => {
    it('UT-USER-008: should set lockedUntil to now + duration', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      const beforeLock = Date.now();
      const durationMs = 30 * 60 * 1000; // 30 minutes

      user.lock(durationMs);

      expect(user.lockedUntil).toBeDefined();
      const lockedTime = user.lockedUntil!.getTime();
      expect(lockedTime).toBeGreaterThanOrEqual(beforeLock + durationMs - 100);
      expect(lockedTime).toBeLessThanOrEqual(beforeLock + durationMs + 100);
    });
  });

  describe('user.login()', () => {
    it('UT-USER-009: should set lastLoginAt to current time', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      expect(user.lastLoginAt).toBeUndefined();

      const before = new Date();
      user.login();
      const after = new Date();

      expect(user.lastLoginAt).toBeDefined();
      expect(user.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.lastLoginAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('user.updateName()', () => {
    it('UT-USER-010: should update the user name', () => {
      const user = User.create('test@example.com', 'pass', 'Old Name');

      user.updateName('New Name');

      expect(user.name).toBe('New Name');
    });
  });

  describe('user.verifyEmail()', () => {
    it('UT-USER-011: should set isVerified to true', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      expect(user.isVerified).toBe(false);

      user.verifyEmail();

      expect(user.isVerified).toBe(true);
    });
  });

  describe('user.changeStatus()', () => {
    it('UT-USER-012: should change user status', () => {
      const user = User.create('test@example.com', 'pass', 'Test');
      expect(user.status).toBe('ACTIVE');

      user.changeStatus('SUSPENDED' as any);

      expect(user.status).toBe('SUSPENDED');
    });
  });

  describe('user.updateAvatar()', () => {
    it('should update avatar URL', () => {
      const user = User.create('test@example.com', 'pass', 'Test');

      user.updateAvatar('https://example.com/avatar.png');

      expect(user.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  describe('user.id', () => {
    it('should use provided id when passed to constructor', () => {
      const user = new User('custom-id-123');

      expect(user.id).toBe('custom-id-123');
    });

    it('should generate uuid when no id provided', () => {
      const user = new User();

      expect(user.id).toBe('test-uuid-123');
    });
  });
});