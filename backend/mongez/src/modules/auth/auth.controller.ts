import { Controller, Post, Get, Body, HttpCode, HttpStatus, ValidationPipe, Req, UseGuards, UseFilters, HttpException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SecurityHeadersGuard } from './guards/security-headers.guard';
import { AuthExceptionFilter } from './filters/auth-exception.filter';

@Controller('auth')
@UseGuards(ThrottlerGuard, SecurityHeadersGuard)
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ValidationPipe({ transform: true })) registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);

    // Set HTTP-only refresh token cookie
    this.setRefreshTokenCookie(req.res as Response, result.refreshToken);

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

    // Clear the refresh token cookie
    this.clearRefreshTokenCookie(req.res as Response);

    return {
      success: true,
      message: 'Logged out successfully',
    };
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

  private setRefreshTokenCookie(response: Response, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieSecure = isProduction;
    const cookieDomain = isProduction ? process.env.COOKIE_DOMAIN : undefined;

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      domain: cookieDomain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
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
  }
}