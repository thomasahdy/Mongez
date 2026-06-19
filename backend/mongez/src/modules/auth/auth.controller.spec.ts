import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfService } from './services/csrf.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SecurityHeadersGuard } from './guards/security-headers.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let csrfService: jest.Mocked<CsrfService>;
  let passwordResetService: jest.Mocked<PasswordResetService>;
  let emailVerificationService: jest.Mocked<EmailVerificationService>;

  const mockAuthResult = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
  };

  const mockResponse = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  } as any;

  const mockRequest = {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
    },
    res: mockResponse,
    cookies: {},
    user: { userId: 'user-1' },
  } as any;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn(),
      completeOnboarding: jest.fn(),
      getUserSessions: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as any;

    csrfService = {
      getSessionId: jest.fn(),
      generateToken: jest.fn(),
    } as any;

    passwordResetService = {
      requestPasswordReset: jest.fn(),
      verifyResetToken: jest.fn(),
      resetPassword: jest.fn(),
    } as any;

    emailVerificationService = {
      sendVerificationToken: jest.fn(),
      verifyEmail: jest.fn(),
      isUserVerified: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: CsrfService, useValue: csrfService },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: EmailVerificationService, useValue: emailVerificationService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SecurityHeadersGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCsrfToken()', () => {
    it('UT-AUTH-CTRL-001: should return generated csrf token and set httpOnly cookie', () => {
      const expiresAt = new Date();
      csrfService.getSessionId.mockReturnValue('session-id-123');
      csrfService.generateToken.mockReturnValue({ token: 'csrf-token-123', expiresAt });

      controller.getCsrfToken(mockRequest, mockResponse);

      expect(csrfService.getSessionId).toHaveBeenCalledWith(mockRequest);
      expect(csrfService.generateToken).toHaveBeenCalledWith('session-id-123');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf_token',
        'csrf-token-123',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          csrfToken: 'csrf-token-123',
          expiresAt: expiresAt.toISOString(),
        },
      });
    });
  });

  describe('register()', () => {
    it('UT-AUTH-CTRL-002: should register user, set cookies, and return auth result', async () => {
      const dto = { email: 'test@example.com', password: 'Password123', name: 'Test User' };
      authService.register.mockResolvedValue(mockAuthResult as any);

      const result = await controller.register(dto, mockRequest);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token-123', expect.any(Object));
      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', 'access-token-123', expect.any(Object));
      expect(result).toEqual({
        success: true,
        data: mockAuthResult,
        message: 'User registered successfully',
      });
    });
  });

  describe('login()', () => {
    it('UT-AUTH-CTRL-003: should login user, set cookies, and return profile', async () => {
      const dto = { email: 'test@example.com', password: 'Password123' };
      authService.login.mockResolvedValue(mockAuthResult as any);

      const result = await controller.login(dto, mockRequest);

      expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1', 'test-agent');
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token-123', expect.any(Object));
      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', 'access-token-123', expect.any(Object));
      expect(result).toEqual({
        success: true,
        data: mockAuthResult,
        message: 'Login successful',
      });
    });
  });

  describe('refresh()', () => {
    it('UT-AUTH-CTRL-004: should refresh token using request body or cookies', async () => {
      authService.refreshToken.mockResolvedValue(mockAuthResult as any);

      const result = await controller.refresh(undefined as any, {
        ...mockRequest,
        cookies: { refresh_token: 'refresh-cookie-123' },
      });

      expect(authService.refreshToken).toHaveBeenCalledWith('refresh-cookie-123');
      expect(result.success).toBe(true);
    });

    it('UT-AUTH-CTRL-005: should throw HttpException when no refresh token is provided', async () => {
      await expect(controller.refresh(undefined as any, mockRequest)).rejects.toThrow(
        new HttpException('Refresh token is required', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('logout()', () => {
    it('UT-AUTH-CTRL-006: should call authService logout and clear cookies', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout('ref-token', mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('ref-token', 'user-1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('csrf_token', expect.any(Object));
      expect(result).toEqual({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('googleAuthRedirect()', () => {
    it('UT-AUTH-CTRL-007: should redirect to frontend with success parameters on successful OAuth', async () => {
      const reqWithUser = {
        ...mockRequest,
        user: { accessToken: 'a', refreshToken: 'r' },
      };

      await controller.googleAuthRedirect(reqWithUser, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', 'a', expect.any(Object));
      expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', 'r', expect.any(Object));
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:5173?auth=success');
    });

    it('UT-AUTH-CTRL-008: should redirect to frontend with error parameter if redirect fails', async () => {
      const reqWithError = {
        ...mockRequest,
        user: null, // trigger crash
      };

      await controller.googleAuthRedirect(reqWithError, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(expect.stringContaining('auth=error'));
    });
  });

  describe('getProfile()', () => {
    it('UT-AUTH-CTRL-009: should return user profile details', async () => {
      authService.getProfile.mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as any);

      const result = await controller.getProfile(mockRequest);

      expect(authService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        success: true,
        data: { id: 'user-1', email: 'test@example.com' },
        message: 'Profile retrieved successfully',
      });
    });
  });

  describe('completeOnboarding()', () => {
    it('UT-AUTH-CTRL-010: should call completeOnboarding service and return success', async () => {
      const dto = { spaceName: 'New Space', departmentName: 'Dev' };
      authService.completeOnboarding.mockResolvedValue(undefined);

      const result = await controller.completeOnboarding(mockRequest, dto);

      expect(authService.completeOnboarding).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({
        success: true,
        message: 'Onboarding completed successfully',
      });
    });
  });

  describe('sessions', () => {
    it('UT-AUTH-CTRL-011: should list user active sessions', async () => {
      authService.getUserSessions.mockResolvedValue([{ id: 'sess-1' }] as any);

      const result = await controller.getSessions(mockRequest);

      expect(authService.getUserSessions).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, data: [{ id: 'sess-1' }] });
    });

    it('UT-AUTH-CTRL-012: should revoke session by ID', async () => {
      authService.revokeSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession(mockRequest, 'sess-1');

      expect(authService.revokeSession).toHaveBeenCalledWith('user-1', 'sess-1');
      expect(result).toEqual({ success: true, message: 'Session revoked successfully' });
    });

    it('UT-AUTH-CTRL-013: should revoke all user sessions', async () => {
      authService.revokeAllSessions.mockResolvedValue(3);

      const result = await controller.revokeAllSessions(mockRequest);

      expect(authService.revokeAllSessions).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, message: 'All sessions revoked successfully', count: 3 });
    });
  });

  describe('password reset', () => {
    it('UT-AUTH-CTRL-014: should trigger requestPasswordReset and return standard message', async () => {
      passwordResetService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({ email: 'test@example.com' });

      expect(passwordResetService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(result.success).toBe(true);
    });

    it('UT-AUTH-CTRL-015: should verify reset token validity', async () => {
      passwordResetService.verifyResetToken.mockResolvedValue({ userId: 'user-1' } as any);

      const result = await controller.verifyResetToken('reset-token-123');

      expect(passwordResetService.verifyResetToken).toHaveBeenCalledWith('reset-token-123');
      expect(result).toEqual({ success: true, message: 'Token is valid', userId: 'user-1' });
    });

    it('UT-AUTH-CTRL-016: should reset password when valid confirmation is supplied', async () => {
      passwordResetService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword({
        token: 'token-123',
        password: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      });

      expect(passwordResetService.resetPassword).toHaveBeenCalledWith('token-123', 'NewPassword123');
      expect(result.success).toBe(true);
    });

    it('UT-AUTH-CTRL-017: should throw BadRequestException if passwords do not match', async () => {
      await expect(
        controller.resetPassword({
          token: 'token-123',
          password: 'NewPassword123',
          confirmPassword: 'MismatchPassword',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('email verification', () => {
    it('UT-AUTH-CTRL-018: should send email verification link', async () => {
      emailVerificationService.sendVerificationToken.mockResolvedValue(undefined);

      const result = await controller.sendVerificationEmail(mockRequest);

      expect(emailVerificationService.sendVerificationToken).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
    });

    it('UT-AUTH-CTRL-019: should verify email using token', async () => {
      emailVerificationService.verifyEmail.mockResolvedValue({ success: true, message: 'Verified' });

      const result = await controller.verifyEmail('token-123');

      expect(emailVerificationService.verifyEmail).toHaveBeenCalledWith('token-123');
      expect(result.success).toBe(true);
    });

    it('UT-AUTH-CTRL-020: should return verification status', async () => {
      emailVerificationService.isUserVerified.mockResolvedValue(true);
      authService.getProfile.mockResolvedValue({ providerId: null } as any);

      const result = await controller.getVerificationStatus(mockRequest);

      expect(emailVerificationService.isUserVerified).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        success: true,
        isVerified: true,
        isOAuthUser: false,
      });
    });
  });
});
