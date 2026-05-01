import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserRepository, UserReadModel } from './repositories/user.repository';
import { UserLogRepository } from './repositories/user-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from './domain/user.entity';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly userRepo: UserRepository,
    private readonly userLogRepo: UserLogRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    // Check if email already exists
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate password strength
    if (!this.passwordService.validatePassword(dto.password)) {
      throw new BadRequestException(
        `Password does not meet requirements: ${this.passwordService.getPasswordRequirements()}`,
      );
    }

    // Hash password
    const hashedPassword = await this.passwordService.hash(dto.password);

    // Create and save user entity
    const name = (dto as any).name || '';
    const user = User.create(dto.email, hashedPassword, name);
    await this.userRepo.save(user);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email);
    const refreshToken = this.jwtService.generateRefreshToken(user.id);

    // Save refresh token
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);
    await this.userRepo.saveRefreshToken(user.id, refreshToken, refreshTokenExpiresAt);

    // Log registration
    await this.userLogRepo.create({
      userId: user.id,
      action: 'USER_REGISTERED',
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResult> {
    // Find user with password
    const user = await this.userRepo.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Check if account is locked
    if (user.isLocked) {
      await this.userLogRepo.create({
        userId: user.id,
        action: 'LOGIN_FAIL',
        ipAddress: ip,
        userAgent,
      });
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    // Verify password
    if (!user.passwordHash) {
      await this.handleFailedLogin(user.id, ip, userAgent, user.failedAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id, ip, userAgent, user.failedAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Record successful login
    await this.userRepo.recordLogin(user.id);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email);
    const refreshToken = this.jwtService.generateRefreshToken(user.id);

    // Save refresh token
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);
    await this.userRepo.saveRefreshToken(user.id, refreshToken, refreshTokenExpiresAt);

    // Log successful login
    await this.userLogRepo.create({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: ip,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Refresh an access token using a refresh token (token rotation)
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    // Verify the refresh token JWT
    let payload: any;
    try {
      payload = await this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if token exists and is valid in the database
    const isValid = await this.refreshTokenRepo.isTokenValid(refreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
    }

    // Get the user
    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke the old refresh token (token rotation)
    await this.refreshTokenRepo.revokeToken(refreshToken);

    // Generate new tokens
    const newAccessToken = this.jwtService.generateAccessToken(user.id, user.email);
    const newRefreshToken = this.jwtService.generateRefreshToken(user.id);

    // Save new refresh token
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);
    await this.userRepo.saveRefreshToken(user.id, newRefreshToken, refreshTokenExpiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Validate and login/register an OAuth user
   */
  async validateOAuthUser(profile: any): Promise<AuthResult> {
    const email = profile.emails[0].value;
    const providerId = profile.id;
    const providerName = profile.provider || 'google';
    const avatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined;

    let userRecord = await this.userRepo.findByEmailWithPassword(email);
    let userId: string;
    let userEmail: string;
    let userName: string;

    if (userRecord) {
      // SECURITY FIX: Prevent implicit linking
      if (userRecord.providerId !== providerId) {
        throw new ConflictException('An account with this email already exists. Please log in with your password to link your accounts.');
      }

      userId = userRecord.id;
      userEmail = userRecord.email;
      userName = userRecord.name;

      if (userRecord.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }
      if (userRecord.isLocked) {
        throw new UnauthorizedException('Account is temporarily locked.');
      }

      await this.userRepo.recordLogin(userId);
    } else {
      const userEntity = User.createOAuthUser(
        email,
        profile.displayName,
        providerName,
        providerId,
        avatarUrl
      );
      await this.userRepo.save(userEntity);

      await this.userLogRepo.create({
        userId: userEntity.id,
        action: 'USER_REGISTERED_OAUTH',
      });

      userId = userEntity.id;
      userEmail = userEntity.email;
      userName = userEntity.name;
    }

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(userId, userEmail);
    const refreshToken = this.jwtService.generateRefreshToken(userId);

    // Hash the refresh token for security before saving it to the DB
    const hashedRefreshToken = await this.passwordService.hash(refreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);
    await this.userRepo.saveRefreshToken(userId, hashedRefreshToken, refreshTokenExpiresAt);

    await this.userLogRepo.create({
      userId,
      action: 'LOGIN_SUCCESS',
      ipAddress: 'OAuth',
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email: userEmail, name: userName },
    };
  }

  /**
   * Logout — revoke the refresh token
   */
  async logout(refreshToken: string, userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeToken(refreshToken);

    await this.userLogRepo.create({
      userId,
      action: 'LOGOUT',
    });
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserReadModel | null> {
    return this.userRepo.findById(userId);
  }

  /**
   * Handle failed login — log it, lock account if threshold reached
   */
  private async handleFailedLogin(userId: string, ip?: string, userAgent?: string, currentAttempts = 0): Promise<void> {
    await this.userLogRepo.create({
      userId,
      action: 'LOGIN_FAIL',
      ipAddress: ip,
      userAgent,
    });

    const newFailedCount = currentAttempts + 1;

    if (newFailedCount >= this.MAX_FAILED_ATTEMPTS) {
      // Lock the account directly via Prisma
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedAttempts: newFailedCount,
          lockedUntil: new Date(Date.now() + this.LOCK_DURATION_MS),
        },
      });
    } else {
      // Just increment failed attempts
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedAttempts: newFailedCount },
      });
    }
  }
}