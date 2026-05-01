import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { UserLogRepository } from './repositories/user-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { User } from './domain/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let userLogRepo: jest.Mocked<UserLogRepository>;
  let refreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let passwordService: jest.Mocked<PasswordService>;
  let prisma: jest.Mocked<PrismaService>;

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
      getRefreshTokenExpiration: jest.fn().mockReturnValue(604800),
    } as any;

    passwordService = {
      validatePassword: jest.fn().mockReturnValue(true),
      hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
      compare: jest.fn(),
      getPasswordRequirements: jest.fn().mockReturnValue('Password must be at least 8 characters, contain uppercase, lowercase, and a digit'),
    } as any;

    prisma = {
      user: {
        update: jest.fn(),
      },
    } as any;

    service = new AuthService(
      userRepo,
      userLogRepo,
      refreshTokenRepo,
      jwtService,
      passwordService,
      prisma,
    );
  });

  // ─── REGISTER ───────────────────────────────────────────────

  describe('register()', () => {
    const registerDto = { email: 'test@example.com', password: 'Password123' };

    it('UT-AUTH-SVC-001: should register with unique email and return tokens', async () => {
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
      expect(userRepo.saveRefreshToken).toHaveBeenCalled();
      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: expect.any(String),
        action: 'USER_REGISTERED',
      });
    });

    it('UT-AUTH-SVC-002: should throw ConflictException for duplicate email', async () => {
      userRepo.existsByEmail.mockResolvedValue(true);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for weak password', async () => {
      passwordService.validatePassword.mockReturnValue(false);

      await expect(service.register({ email: 'test@example.com', password: 'weak' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass name from dto when provided', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      const dtoWithName = { email: 'test@example.com', password: 'Password123', name: 'Test User' };

      const result = await service.register(dtoWithName as any);

      expect(result.user.name).toBe('Test User');
    });
  });

  // ─── LOGIN ──────────────────────────────────────────────────

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

    it('UT-AUTH-SVC-003: should return tokens for valid credentials', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
      expect(result.user.email).toBe('test@example.com');
      expect(userRepo.recordLogin).toHaveBeenCalledWith('user-123');
      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCESS' }),
      );
    });

    it('UT-AUTH-SVC-005: should throw UnauthorizedException for non-existent email', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for non-active account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow('Account is not active');
    });

    it('UT-AUTH-SVC-005: should throw UnauthorizedException for locked account', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        isLocked: true,
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow('temporarily locked');
      expect(userLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAIL' }),
      );
    });

    it('UT-AUTH-SVC-004: should increment failed attempts on wrong password', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue(mockUser as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('UT-AUTH-SVC-006: should lock account after 5th failed attempt', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        failedAttempts: 4,
      } as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');

      // The handleFailedLogin should lock the account since newFailedCount (5) >= MAX_FAILED_ATTEMPTS (5)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle missing passwordHash (OAuth user)', async () => {
      userRepo.findByEmailWithPassword.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });

  // ─── REFRESH TOKEN ──────────────────────────────────────────

  describe('refreshToken()', () => {
    it('UT-AUTH-SVC-008: should rotate refresh token and return new pair', async () => {
      const payload = { sub: 'user-123' };
      jwtService.verifyRefreshToken.mockResolvedValue(payload);
      refreshTokenRepo.isTokenValid.mockResolvedValue(true);
      userRepo.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      } as any);

      const result = await service.refreshToken('old-refresh-token');

      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith('old-refresh-token');
      expect(jwtService.generateAccessToken).toHaveBeenCalled();
      expect(jwtService.generateRefreshToken).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token-mock');
      expect(result.refreshToken).toBe('refresh-token-mock');
    });

    it('UT-AUTH-SVC-009: should throw for revoked token', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(false);

      await expect(service.refreshToken('revoked-token')).rejects.toThrow('revoked');
    });

    it('should throw for invalid JWT', async () => {
      jwtService.verifyRefreshToken.mockRejectedValue(new Error('invalid'));

      await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user not found', async () => {
      jwtService.verifyRefreshToken.mockResolvedValue({ sub: 'user-123' });
      refreshTokenRepo.isTokenValid.mockResolvedValue(true);
      userRepo.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow('User not found');
    });
  });

  // ─── LOGOUT ─────────────────────────────────────────────────

  describe('logout()', () => {
    it('UT-AUTH-SVC-010: should revoke the refresh token', async () => {
      await service.logout('refresh-token', 'user-123');

      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith('refresh-token');
      expect(userLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'LOGOUT',
      });
    });
  });

  // ─── GET PROFILE ────────────────────────────────────────────

  describe('getProfile()', () => {
    it('should return user profile', async () => {
      const mockProfile = { id: 'user-123', email: 'test@example.com', name: 'Test' };
      userRepo.findById.mockResolvedValue(mockProfile as any);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(mockProfile);
    });

    it('should return null for non-existent user', async () => {
      userRepo.findById.mockResolvedValue(null);

      const result = await service.getProfile('non-existent');

      expect(result).toBeNull();
    });
  });
});