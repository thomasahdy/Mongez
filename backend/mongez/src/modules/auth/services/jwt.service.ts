import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate an access token for a user
   * @param userId The user ID
   * @param email The user email
   * @param role The user role
   * @returns string The JWT access token
   */
  generateAccessToken(userId: string, email: string, role: string): string {
    const payload = {
      sub: userId,
      email: email,
      role: role,
      iat: Math.floor(Date.now() / 1000),
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.accessTokenSecret'),
      expiresIn: this.configService.get<string>('auth.jwt.accessTokenExpiresIn') as any,
    });
  }

  /**
   * Generate a refresh token for a user
   * @param userId The user ID
   * @returns string The JWT refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload = {
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.refreshTokenSecret'),
      expiresIn: this.configService.get<string>('auth.jwt.refreshTokenExpiresIn') as any,
    });
  }

  /**
   * Verify an access token
   * @param token The access token to verify
   * @returns Promise<any> The decoded payload
   */
  async verifyAccessToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('auth.jwt.accessTokenSecret'),
    });
  }

  /**
   * Verify a refresh token
   * @param token The refresh token to verify
   * @returns Promise<any> The decoded payload
   */
  async verifyRefreshToken(token: string): Promise<any> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('auth.jwt.refreshTokenSecret'),
    });
  }

  /**
   * Get the expiration time for access tokens
   * @returns number Expiration time in seconds
   */
  getAccessTokenExpiration(): number {
    const expiresIn = this.configService.get<string>('auth.jwt.accessTokenExpiresIn');
    if (!expiresIn) return 900; // Default 15 minutes
    return this.parseDurationToSeconds(expiresIn);
  }

  /**
   * Get the expiration time for refresh tokens
   * @returns number Expiration time in seconds
   */
  getRefreshTokenExpiration(): number {
    const expiresIn = this.configService.get<string>('auth.jwt.refreshTokenExpiresIn');
    if (!expiresIn) return 604800; // Default 7 days
    return this.parseDurationToSeconds(expiresIn);
  }

  /**
   * Parse a duration string to seconds
   * @param duration The duration string (e.g., '15m', '7d')
   * @returns number Duration in seconds
   */
  private parseDurationToSeconds(duration: string): number {
    const unit = duration.charAt(duration.length - 1);
    const value = parseInt(duration.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return value;
    }
  }
}