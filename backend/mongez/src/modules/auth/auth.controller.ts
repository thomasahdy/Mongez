import { Controller, Post, Get, Delete, Body, HttpCode, HttpStatus, ValidationPipe, Req, Res, UseGuards, UseFilters, HttpException, Param } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { SecurityHeadersGuard } from './guards/security-headers.guard';
import { AuthExceptionFilter } from './filters/auth-exception.filter';
import { CsrfService } from './services/csrf.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Controller('auth')
@UseGuards(ThrottlerGuard, SecurityHeadersGuard)
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    const sessionId = this.csrfService.getSessionId(req);
    const { token, expiresAt } = this.csrfService.generateToken(sessionId);

    // Set CSRF token as HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = isProduction;
    const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    res.cookie('csrf_token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      domain: cookieDomain,
      path: '/',
      expires: expiresAt,
    });

    return res.json({
      success: true,
      data: {
        csrfToken: token, // Also return for clients that need to include it manually
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ValidationPipe({ transform: true })) registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    // Set HTTP-only refresh token cookie
    this.setRefreshTokenCookie(req.res as Response, result.refreshToken);
    this.setAccessTokenCookie(req.res as Response, result.accessToken);

    return {
      success: true,
      data: result,
      message: 'User registered successfully',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ValidationPipe({ transform: true })) loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(
      loginDto,
      req.ip,
      req.headers['user-agent'] as string,
    );
    // Set HTTP-only refresh token cookie
    this.setRefreshTokenCookie(req.res as Response, result.refreshToken);
    this.setAccessTokenCookie(req.res as Response, result.accessToken);

    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    // Try to get refresh token from cookie if not provided in body
    if (!refreshToken) {
      refreshToken = req.cookies?.refresh_token;
    }

    if (!refreshToken) {
      throw new HttpException('Refresh token is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new refresh token cookie
    this.setRefreshTokenCookie(req.res as Response, result.refreshToken);
    this.setAccessTokenCookie(req.res as Response, result.accessToken);

    return {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    // Get refresh token from cookie if not provided in body
    if (!refreshToken) {
      refreshToken = req.cookies?.refresh_token;
    }

    if (!refreshToken) {
      throw new HttpException('Refresh token is required', HttpStatus.BAD_REQUEST);
    }

    const userId = (req as any).user?.userId;
    await this.authService.logout(refreshToken, userId);

    // Clear the auth cookies
    this.clearAuthCookies(req.res as Response);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Guard redirects
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const state = req.query.state as string;
      const code = req.query.code as string;
      const scope = req.query.scope as string;

      if (state && scope?.includes('drive')) {
        await this.integrationsService.connectGoogleDrive(state, code);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/settings/integrations?connected=google`);
      }

      const authResult = req.user as any;

      // Set HTTP-only refresh token cookie
      this.setRefreshTokenCookie(res, authResult.refreshToken);
      this.setAccessTokenCookie(res, authResult.accessToken);

      // Redirect directly to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}?auth=success`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorMessage = encodeURIComponent(error instanceof Error ? error.message : 'OAuth authentication failed');
      return res.redirect(`${frontendUrl}?auth=error&error=${errorMessage}`);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request): Promise<any> {
    const userId = (req as any).user?.userId;
    const profile = await this.authService.getProfile(userId);

    return {
      success: true,
      data: profile,
      message: 'Profile retrieved successfully',
    };
  }

  @Post('complete-onboarding')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async completeOnboarding(
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true })) dto: CompleteOnboardingDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId = (req as any).user?.userId;
    await this.authService.completeOnboarding(userId, dto);

    return {
      success: true,
      message: 'Onboarding completed successfully',
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: Request): Promise<any> {
    const userId = (req as any).user?.userId;
    const sessions = await this.authService.getUserSessions(userId);

    return {
      success: true,
      data: sessions,
    };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = (req as any).user?.userId;
    await this.authService.revokeSession(userId, sessionId);

    return {
      success: true,
      message: 'Session revoked successfully',
    };
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@Req() req: Request): Promise<{ success: boolean; message: string; count: number }> {
    const userId = (req as any).user?.userId;
    const count = await this.authService.revokeAllSessions(userId);

    return {
      success: true,
      message: 'All sessions revoked successfully',
      count,
    };
  }

  // Password Reset Endpoints (for non-OAuth users only)

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ValidationPipe({ transform: true })) dto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.passwordResetService.requestPasswordReset(dto.email);

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    };
  }

  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  async verifyResetToken(
    @Body('token') token: string,
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    const result = await this.passwordResetService.verifyResetToken(token);

    return {
      success: true,
      message: 'Token is valid',
      userId: result.userId,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ValidationPipe({ transform: true })) dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    // Validate password confirmation
    if (dto.password !== dto.confirmPassword) {
      throw new HttpException('Passwords do not match', HttpStatus.BAD_REQUEST);
    }

    await this.passwordResetService.resetPassword(dto.token, dto.password);

    return {
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    };
  }

  // Email Verification Endpoints (for non-OAuth users only)

  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async sendVerificationEmail(@Req() req: Request): Promise<{ success: boolean; message: string }> {
    const userId = (req as any).user?.userId;
    await this.emailVerificationService.sendVerificationToken(userId);

    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body('token') token: string): Promise<{ success: boolean; message: string }> {
    const result = await this.emailVerificationService.verifyEmail(token);

    return result;
  }

  @Get('verification-status')
  @UseGuards(JwtAuthGuard)
  async getVerificationStatus(@Req() req: Request): Promise<{ success: boolean; isVerified: boolean; isOAuthUser: boolean }> {
    const userId = (req as any).user?.userId;
    const isVerified = await this.emailVerificationService.isUserVerified(userId);

    const user = await this.authService.getProfile(userId);
    const isOAuthUser = Boolean(user?.providerId);

    return {
      success: true,
      isVerified,
      isOAuthUser,
    };
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = isProduction;
    const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict', // Changed from 'lax' to 'strict'
      domain: cookieDomain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private setAccessTokenCookie(response: Response, accessToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = isProduction;
    const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict', // Changed from 'lax' to 'strict'
      domain: cookieDomain,
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches token expiration)
    });
  }

  private clearAuthCookies(response: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = isProduction;
    const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    response.clearCookie('refresh_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      domain: cookieDomain,
      path: '/',
    });

    response.clearCookie('access_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      domain: cookieDomain,
      path: '/',
    });

    response.clearCookie('csrf_token', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      domain: cookieDomain,
      path: '/',
    });
  }
}