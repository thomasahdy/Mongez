import { AuthService } from './auth.service';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { UserLogRepository } from './repositories/user-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SessionService } from './services/session.service';
import { User } from './domain/user.entity';
import { StorageService } from '../../infrastructure/storage/storage.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let userLogRepo: jest.Mocked<UserLogRepository>;
  let refreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let passwordService: jest.Mocked<PasswordService>;
  let prisma: any;
  let sessionService: jest.Mocked<SessionService>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    userRepo = {
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
      recordLogin: jest.fn(),
      saveRefreshToken: jest.fn(),
    } as any;

    userLogRepo = {
      create: jest.fn(),
    } as any;

    refreshTokenRepo = {
      isTokenValid: jest.fn(),
      revokeToken: jest.fn(),
    } as any;

    jwtService = {
      generateAccessToken: jest.fn().mockReturnValue('access-token-mock'),
      generateRefreshToken: jest.fn().mockReturnValue('refresh-token-mock'),
      verifyRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      getRefreshTokenExpiration: jest.fn().mockReturnValue(604800),
    } as any;

    passwordService = {
      validatePassword: jest.fn().mockReturnValue(true),
      hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
      compare: jest.fn(),
      getPasswordRequirements: jest
        .fn()
        .mockReturnValue(
          'Password must be at least 8 characters, contain uppercase, lowercase, and a digit',
        ),
    } as any;

    prisma = {
      user: {
        update: jest.fn(),
      },
      userSession: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    sessionService = {
      createSession: jest.fn().mockResolvedValue(undefined),
      getUserSessions: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as any;

    storageService = {
      getSignedUrl: jest.fn((key: string) => Promise.resolve(`/api/v1/files/key/${encodeURIComponent(key)}/download?signature=test`)),
    } as any;

    service = new AuthService(
      userRepo,
      userLogRepo,
      refreshTokenRepo,
      jwtService,
      passwordService,
      prisma,
      sessionService,
      storageService,
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // Tree 6: AuthService.register
  // ═══════════════════════════════════════════════════════════════

  describe('register()', () => {
    const registerDto = { email: 'test@example.com', password: 'Password123' };

    // ── Happy Path ─────────────────────────────────────────────

    it('UT-AUTH-REG-001: should register with unique email and return tokens', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'access-token-mock',
        refreshToken: 'refresh-token-mock',
        user: {
          id: expect.any(String),
          email: 'test@example.com',
          name: '',
        },
      });
      expect(userRepo.save).toHaveBeenCalledWith(expect.any(User));
      expect(jwtService.generateAccessToken).toHaveBeenCalled();
      expect(jwtService.generateRefreshToken).toHaveBeenCalled();
      expect(sessionService.createSession).toHaveBeenCalled();
      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: expect.any(String),
        action: 'USER_REGISTERED',
      });
    });

    it('UT-AUTH-REG-002: should pass name from dto when provided', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      const dtoWithName = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      };

      const result = await service.register(dtoWithName as any);

      expect(result.user.name).toBe('Test User');
    });

    // ── Duplicate Email Path ───────────────────────────────────

    it('UT-AUTH-REG-003: should throw ConflictException for duplicate email', async () => {
      userRepo.existsByEmail.mockResolvedValue(true);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    // ── Password Validation Path ──────────────────────────────

    it('UT-AUTH-REG-004: should throw BadRequestException for weak password', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      passwordService.validatePassword.mockReturnValue(false);

      await expect(
        service.register({ email: 'test@example.com', password: 'weak' }),
      ).rejects.toThrow(BadRequestException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('UT-AUTH-REG-005: should include password requirements in error message', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      passwordService.validatePassword.mockReturnValue(false);

      await expect(
        service.register({ email: 'new@test.com', password: 'weak' }),
      ).rejects.toThrow(/Password does not meet requirements/);
    });

    // ── DB Failure Path ───────────────────────────────────────

    it('UT-AUTH-REG-006: should propagate error when user save fails', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      userRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.register(registerDto)).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('UT-AUTH-REG-007: should propagate error when session creation fails', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      sessionService.createSession.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Redis unavailable',
      );
    });

    // ── Side Effects Verification ─────────────────────────────

    it('UT-AUTH-REG-008: should hash the password before saving', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);

      await service.register(registerDto);

      expect(passwordService.hash).toHaveBeenCalledWith('Password123');
    });

    it('UT-AUTH-REG-009: should create a session with correct expiry', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);

      await service.register(registerDto);

      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.any(String),
        'refresh-token-mock',
        expect.any(Date),
      );
    });

    it('UT-AUTH-REG-010: should log USER_REGISTERED audit action', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);

      await service.register(registerDto);

      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_REGISTERED' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Tree 7: AuthService.login
  // ═══════════════════════════════════════════════════════════════

  describe('login()', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123' };
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'ACTIVE',
      isLocked: false,
      passwordHash: '$2b$10$hashedpassword',
      failedAttempts: 0,
    };

    // ── Happy Path ─────────────────────────────────────────────

    it('UT-AUTH-LOGIN-001: should return tokens for valid credentials', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
      expect(result.user.email).toBe('test@example.com');
      expect(userRepo.recordLogin).toHaveBeenCalledWith('user-123');
    });

    it('UT-AUTH-LOGIN-002: should log successful login with IP and userAgent', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);

      await service.login(loginDto, '192.168.1.1', 'Chrome/120');

      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'LOGIN_SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120',
      });
    });

    it('UT-AUTH-LOGIN-003: should create session with metadata', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);

      await service.login(loginDto, '10.0.0.1', 'Firefox/115');

      expect(sessionService.createSession).toHaveBeenCalledWith(
        'user-123',
        'refresh-token-mock',
        expect.any(Date),
        { ip: '10.0.0.1', userAgent: 'Firefox/115' },
      );
    });

    // ── User Not Found Path ────────────────────────────────────

    it('UT-AUTH-LOGIN-004: should throw UnauthorizedException for non-existent email', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    // ── Account Status Path ───────────────────────────────────

    it('UT-AUTH-LOGIN-005: should throw UnauthorizedException for SUSPENDED account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Account is not active',
      );
    });

    it('UT-AUTH-LOGIN-006: should throw UnauthorizedException for DELETED account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        status: 'DELETED',
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Account is not active',
      );
    });

    // ── Account Locked Path ───────────────────────────────────

    it('UT-AUTH-LOGIN-007: should throw ForbiddenException for locked account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        isLocked: true,
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'temporarily locked',
      );
    });

    it('UT-AUTH-LOGIN-008: should log LOGIN_FAIL for locked account attempt', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        isLocked: true,
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow();

      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAIL' }),
      );
    });

    // ── Password Verification Path ────────────────────────────

    it('UT-AUTH-LOGIN-009: should throw for missing passwordHash (OAuth-only account)', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(prisma.user.update).toHaveBeenCalled(); // failedAttempts incremented
    });

    it('UT-AUTH-LOGIN-010: should increment failed attempts on wrong password', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        failedAttempts: 2,
      } as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { failedAttempts: 3 },
      });
    });

    it('UT-AUTH-LOGIN-011: should lock account after 5th failed attempt', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        failedAttempts: 4,
      } as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('UT-AUTH-LOGIN-012: should set lockedUntil to 30 minutes in the future', async () => {
      jest.useFakeTimers();
      const now = new Date('2026-06-20T12:00:00Z');
      jest.setSystemTime(now);

      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        failedAttempts: 4,
      } as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow();

      const updateCall = prisma.user.update.mock.calls[0][0];
      const lockedUntil = updateCall.data.lockedUntil as Date;
      expect(lockedUntil.getTime()).toBe(now.getTime() + 30 * 60 * 1000);

      jest.useRealTimers();
    });

    it('UT-AUTH-LOGIN-013: should log failed login attempt with IP', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login(loginDto, '10.0.0.1', 'curl/7.68'),
      ).rejects.toThrow();

      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'LOGIN_FAIL',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.68',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Tree 8: AuthService.refreshToken
  // ═══════════════════════════════════════════════════════════════

  describe('refreshToken()', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    // ── Happy Path ─────────────────────────────────────────────

    it('UT-AUTH-REFRESH-001: should rotate token and return new pair', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(true);
      userRepo.findById.mockResolvedValue(mockUser as any);

      const result = await service.refreshToken('old-refresh-token');

      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith(
        'old-refresh-token',
      );
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
      );
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith('user-123');
      expect(sessionService.createSession).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    // ── JWT Verification Failure ──────────────────────────────

    it('UT-AUTH-REFRESH-002: should throw for invalid JWT signature', async () => {
      jwtService.verifyRefreshToken.mockRejectedValue(
        new Error('invalid signature'),
      );

      await expect(service.refreshToken('tampered-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken('tampered-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('UT-AUTH-REFRESH-003: should throw for expired JWT', async () => {
      jwtService.verifyRefreshToken.mockRejectedValue(
        new Error('jwt expired'),
      );

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // ── Revoked/Invalid DB Token ──────────────────────────────

    it('UT-AUTH-REFRESH-004: should throw for revoked token in DB', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(false);

      await expect(service.refreshToken('revoked-token')).rejects.toThrow(
        'revoked',
      );
    });

    // ── User Not Found (Deleted Account) ──────────────────────

    it('UT-AUTH-REFRESH-005: should throw when user no longer exists', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'deleted-user' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(true);
      userRepo.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        'User not found',
      );
    });

    // ── Token Rotation Verification ───────────────────────────

    it('UT-AUTH-REFRESH-006: should revoke old token before generating new one', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(true);
      userRepo.findById.mockResolvedValue(mockUser as any);

      await service.refreshToken('old-token');

      const revokeCallOrder =
        refreshTokenRepo.revokeToken.mock.invocationCallOrder[0];
      const generateCallOrder =
        jwtService.generateAccessToken.mock.invocationCallOrder[0];
      expect(revokeCallOrder).toBeLessThan(generateCallOrder);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Tree 9: AuthService.validateOAuthUser
  // ═══════════════════════════════════════════════════════════════

  describe('validateOAuthUser()', () => {
    const googleProfile = {
      id: 'google-provider-id-123',
      provider: 'google',
      displayName: 'Google User',
      emails: [{ value: 'google@example.com' }],
      photos: [{ value: 'https://lh3.google.com/avatar.jpg' }],
    };

    // ── Happy Path: New User ──────────────────────────────────

    it('UT-AUTH-OAUTH-001: should create new user for first-time OAuth login', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      const result = await service.validateOAuthUser(googleProfile);

      expect(userRepo.save).toHaveBeenCalledWith(expect.any(User));
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_REGISTERED_OAUTH' }),
      );
    });

    // ── Happy Path: Existing User ─────────────────────────────

    it('UT-AUTH-OAUTH-002: should log in existing user with matching providerId', async () => {
      const existingUser = {
        id: 'user-456',
        email: 'google@example.com',
        name: 'Google User',
        status: 'ACTIVE',
        isLocked: false,
        providerId: 'google-provider-id-123',
      };
      userRepo.findByEmailWithPassword.mockResolvedValue(
        existingUser as any,
      );

      const result = await service.validateOAuthUser(googleProfile);

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(userRepo.recordLogin).toHaveBeenCalledWith('user-456');
      expect(result.user.id).toBe('user-456');
    });

    // ── Implicit Linking Prevention ───────────────────────────

    it('UT-AUTH-OAUTH-003: should throw ConflictException when email exists with different providerId', async () => {
      const localUser = {
        id: 'user-789',
        email: 'google@example.com',
        name: 'Local User',
        status: 'ACTIVE',
        isLocked: false,
        providerId: 'different-provider-id',
      };
      userRepo.findByEmailWithPassword.mockResolvedValue(localUser as any);

      await expect(
        service.validateOAuthUser(googleProfile),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.validateOAuthUser(googleProfile),
      ).rejects.toThrow('already exists');
    });

    // ── Inactive Account Path ─────────────────────────────────

    it('UT-AUTH-OAUTH-004: should throw UnauthorizedException for non-ACTIVE account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        id: 'user-456',
        email: 'google@example.com',
        name: 'Suspended',
        status: 'SUSPENDED',
        isLocked: false,
        providerId: 'google-provider-id-123',
      } as any);

      await expect(
        service.validateOAuthUser(googleProfile),
      ).rejects.toThrow(UnauthorizedException);
    });

    // ── Locked Account Path ───────────────────────────────────

    it('UT-AUTH-OAUTH-005: should throw ForbiddenException for locked account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        id: 'user-456',
        email: 'google@example.com',
        name: 'Locked User',
        status: 'ACTIVE',
        isLocked: true,
        providerId: 'google-provider-id-123',
      } as any);

      await expect(
        service.validateOAuthUser(googleProfile),
      ).rejects.toThrow(ForbiddenException);
    });

    // ── Edge Cases ────────────────────────────────────────────

    it('UT-AUTH-OAUTH-006: should handle profile without photos', async () => {
      const noPhotoProfile = {
        ...googleProfile,
        photos: [],
      };
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      const result = await service.validateOAuthUser(noPhotoProfile);

      expect(result.accessToken).toBeDefined();
    });

    it('UT-AUTH-OAUTH-007: should default provider to google when not specified', async () => {
      const noProviderProfile = {
        ...googleProfile,
        provider: undefined,
      };
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      await service.validateOAuthUser(noProviderProfile);

      // Should create an OAuth user — provider defaults to 'google'
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('UT-AUTH-OAUTH-008: should create session with OAuth IP marker', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      await service.validateOAuthUser(googleProfile);

      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.any(String),
        'refresh-token-mock',
        expect.any(Date),
        { ip: 'OAuth' },
      );
    });

    it('UT-AUTH-OAUTH-009: should log LOGIN_SUCCESS for existing OAuth user', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        id: 'user-456',
        email: 'google@example.com',
        name: 'Google User',
        status: 'ACTIVE',
        isLocked: false,
        providerId: 'google-provider-id-123',
      } as any);

      await service.validateOAuthUser(googleProfile);

      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_SUCCESS',
          ipAddress: 'OAuth',
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.logout
  // ═══════════════════════════════════════════════════════════════

  describe('logout()', () => {
    it('UT-AUTH-LOGOUT-001: should revoke the refresh token', async () => {
      await service.logout('refresh-token', 'user-123');

      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });

    it('UT-AUTH-LOGOUT-002: should log LOGOUT audit action', async () => {
      await service.logout('refresh-token', 'user-123');

      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'LOGOUT',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.getUserSessions
  // ═══════════════════════════════════════════════════════════════

  describe('getUserSessions()', () => {
    it('UT-AUTH-SESS-001: should delegate to sessionService', async () => {
      const mockSessions = [
        { id: 'session-1', createdAt: new Date(), ip: '10.0.0.1' },
      ];
      sessionService.getUserSessions.mockResolvedValue(mockSessions as any);

      const result = await service.getUserSessions('user-123');

      expect(sessionService.getUserSessions).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockSessions);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.revokeSession
  // ═══════════════════════════════════════════════════════════════

  describe('revokeSession()', () => {
    it('UT-AUTH-REVOKE-001: should delete own session', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
      });

      await service.revokeSession('user-123', 'session-1');

      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('UT-AUTH-REVOKE-002: should throw BadRequestException for non-existent session', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeSession('user-123', 'non-existent'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.revokeSession('user-123', 'non-existent'),
      ).rejects.toThrow('Session not found');
    });

    it('UT-AUTH-REVOKE-003: should throw UnauthorizedException when revoking another user session', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'other-user',
      });

      await expect(
        service.revokeSession('user-123', 'session-1'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.revokeSession('user-123', 'session-1'),
      ).rejects.toThrow('your own sessions');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.revokeAllSessions
  // ═══════════════════════════════════════════════════════════════

  describe('revokeAllSessions()', () => {
    it('UT-AUTH-REVOKEALL-001: should delegate to sessionService and return count', async () => {
      sessionService.revokeAllSessions.mockResolvedValue(3);

      const result = await service.revokeAllSessions('user-123');

      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
      expect(result).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.getProfile
  // ═══════════════════════════════════════════════════════════════

  describe('getProfile()', () => {
    it('UT-AUTH-PROFILE-001: should return user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
      };
      userRepo.findById.mockResolvedValue(mockProfile as any);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(mockProfile);
    });

    it('UT-AUTH-PROFILE-003: should return public URL for stored avatar keys', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
        avatarUrl: 'avatars/user-123/avatar.png',
      };
      userRepo.findById.mockResolvedValue(mockProfile as any);
      storageService.getSignedUrl.mockResolvedValue('/api/v1/files/key/avatars%2Fuser-123%2Favatar.png/download?signature=test');

      const result = await service.getProfile('user-123');

      expect(storageService.getSignedUrl).toHaveBeenCalledWith('avatars/user-123/avatar.png', 3600);
      expect(result?.avatarUrl).toBe('/api/v1/files/key/avatars%2Fuser-123%2Favatar.png/download?signature=test');
    });

    it('UT-AUTH-PROFILE-002: should return null for non-existent user', async () => {
      userRepo.findById.mockResolvedValue(null);

      const result = await service.getProfile('non-existent');

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.completeOnboarding
  // ═══════════════════════════════════════════════════════════════

  describe('completeOnboarding()', () => {
    const onboardingDto = {
      organization: {
        name: 'Test Org',
        industry: 'Technology',
        size: '10-50',
        country: 'US',
      },
      template: 'project-board',
      invites: [{ email: 'invite@test.com', role: 'MEMBER' }],
    };

    it('UT-AUTH-ONBOARD-001: should execute full onboarding in a serializable transaction', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 'space-1', prefix: 'TES' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'dept-1' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'board-1' }) },
        boardColumn: { create: jest.fn() },
        invitation: { create: jest.fn() },
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', onboardingDto as any);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ONBOARDING_COMPLETED' }),
      );
    });

    it('UT-AUTH-ONBOARD-002: should throw BadRequestException when OWNER role not found', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await expect(
        service.completeOnboarding('user-123', onboardingDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeOnboarding('user-123', onboardingDto as any),
      ).rejects.toThrow('OWNER role not found');
    });

    it('UT-AUTH-ONBOARD-003: should handle onboarding without invites', async () => {
      const noInvitesDto = {
        organization: { name: 'Solo Org' },
        template: 'blank',
        invites: [],
      };
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 'space-2', prefix: 'SOL' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'dept-2' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'board-2' }) },
        boardColumn: { create: jest.fn() },
        invitation: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', noInvitesDto as any);

      expect(txMock.invitation.create).not.toHaveBeenCalled();
    });

    it('UT-AUTH-ONBOARD-004: should default to blank template when not provided', async () => {
      const noTemplateDto = {
        organization: { name: 'Default Org' },
        template: undefined,
        invites: [],
      };
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 'space-3', prefix: 'DEF' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'dept-3' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'board-3' }) },
        boardColumn: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', noTemplateDto as any);

      // Should not throw — uses 'blank' as fallback
      expect(txMock.board.create).toHaveBeenCalled();
    });

    it('UT-AUTH-ONBOARD-005: should log onboarding completion outside transaction', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 'space-1', prefix: 'TES' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'dept-1' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'board-1' }) },
        boardColumn: { create: jest.fn() },
        invitation: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', onboardingDto as any);

      // Audit log should happen AFTER transaction succeeds
      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'ONBOARDING_COMPLETED',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AuthService.generateSpacePrefix (private — tested via completeOnboarding)
  // ═══════════════════════════════════════════════════════════════

  describe('generateSpacePrefix() — via completeOnboarding', () => {
    it('UT-AUTH-PREFIX-001: should generate 3-letter prefix from long name', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 's1', prefix: 'TEC' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'd1' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'b1' }) },
        boardColumn: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', {
        organization: { name: 'Technology Corp' },
        template: 'blank',
        invites: [],
      } as any);

      expect(txMock.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prefix: 'TEC',
          }),
        }),
      );
    });

    it('UT-AUTH-PREFIX-002: should pad short names with X', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 's2', prefix: 'AXX' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'd2' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'b2' }) },
        boardColumn: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', {
        organization: { name: 'A' },
        template: 'blank',
        invites: [],
      } as any);

      expect(txMock.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prefix: 'AXX',
          }),
        }),
      );
    });

    it('UT-AUTH-PREFIX-003: should strip non-alpha characters', async () => {
      const txMock = {
        role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-owner', name: 'OWNER' }) },
        space: { create: jest.fn().mockResolvedValue({ id: 's3', prefix: 'TES' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'd3' }) },
        membership: { create: jest.fn() },
        board: { create: jest.fn().mockResolvedValue({ id: 'b3' }) },
        boardColumn: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(txMock));

      await service.completeOnboarding('user-123', {
        organization: { name: '123 Test!!' },
        template: 'blank',
        invites: [],
      } as any);

      expect(txMock.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prefix: 'TES',
          }),
        }),
      );
    });
  });
});
