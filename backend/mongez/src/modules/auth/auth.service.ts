import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRepository, UserReadModel } from './repositories/user.repository';
import { UserLogRepository } from './repositories/user-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { JwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { User } from './domain/user.entity';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditAction } from './constants/audit-actions.constant';
import { StorageService } from '../../infrastructure/storage/storage.service';

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
    private readonly sessionService: SessionService,
    private readonly storage: StorageService,
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

    // Create a default FREE user subscription
    await this.prisma.subscription.create({
      data: {
        userId: user.id,
        tier: 'FREE',
        startsAt: new Date(),
      },
    });

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email);
    const refreshToken = this.jwtService.generateRefreshToken(user.id);
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);

    // Create session with limits
    await this.sessionService.createSession(user.id, refreshToken, refreshTokenExpiresAt);

    // Log registration
    await this.userLogRepo.create({
      userId: user.id,
      action: AuditAction.USER_REGISTERED,
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
        action: AuditAction.LOGIN_FAIL,
        ipAddress: ip,
        userAgent,
      });
      throw new ForbiddenException('Account is temporarily locked. Please try again later.');
    }

    // Verify password
    if (!user.passwordHash) {
      await this.handleFailedLogin(user.id, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Record successful login
    await this.userRepo.recordLogin(user.id);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user.id, user.email);
    const refreshToken = this.jwtService.generateRefreshToken(user.id);
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);

    // Create session with limits
    await this.sessionService.createSession(user.id, refreshToken, refreshTokenExpiresAt, { ip, userAgent });

    // Log successful login
    await this.userLogRepo.create({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
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
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);

    // Create new session (old one is revoked)
    await this.sessionService.createSession(user.id, newRefreshToken, refreshTokenExpiresAt);

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
        throw new ForbiddenException('Account is temporarily locked.');
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
        action: AuditAction.USER_REGISTERED_OAUTH,
      });

      // Create a default FREE user subscription
      await this.prisma.subscription.create({
        data: {
          userId: userEntity.id,
          tier: 'FREE',
          startsAt: new Date(),
        },
      });

      userId = userEntity.id;
      userEmail = userEntity.email;
      userName = userEntity.name;
    }

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(userId, userEmail);
    const refreshToken = this.jwtService.generateRefreshToken(userId);
    const refreshTokenExpiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiration() * 1000);

    // Create session
    await this.sessionService.createSession(userId, refreshToken, refreshTokenExpiresAt, { ip: 'OAuth' });

    await this.userLogRepo.create({
      userId,
      action: AuditAction.LOGIN_SUCCESS,
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
      action: AuditAction.LOGOUT,
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.userId !== userId) {
      throw new UnauthorizedException('You can only revoke your own sessions');
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Revoke all sessions for a user (logout from all devices)
   */
  async revokeAllSessions(userId: string): Promise<number> {
    return this.sessionService.revokeAllSessions(userId);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserReadModel | null> {
    const user = await this.userRepo.findById(userId);
    return this.withPublicAvatarUrl(user);
  }

  /**
   * Complete onboarding - create organization, setup template, and invite team members
   */
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto): Promise<void> {
    const { organization, template, invites } = dto;

    await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Get the default OWNER role
        const ownerRole = await tx.role.findUnique({
          where: { name: 'OWNER' },
        });

        if (!ownerRole) {
          throw new BadRequestException('Default OWNER role not found. Please contact support.');
        }

        // Create a space (organization) for the user
        const space = await tx.space.create({
          data: {
            name: organization.name,
            description: organization.industry ? `Industry: ${organization.industry}, Size: ${organization.size}, Country: ${organization.country}` : null,
            prefix: this.generateSpacePrefix(organization.name),
            subscriptionPlanId: null,
          },
        });

        // Create a default department
        const department = await tx.department.create({
          data: {
            name: 'General',
            description: 'Default department',
            spaceId: space.id,
            color: '#00a8e8',
          },
        });

        // Add user as OWNER of the space
        await tx.membership.create({
          data: {
            userId,
            spaceId: space.id,
            departmentId: department.id,
            roleId: ownerRole.id,
            acceptedAt: new Date(),
          },
        });

        // Create initial board based on template
        await this.createTemplateBoard(department.id, template || 'blank', tx);

        // Send invitations
        if (invites && invites.length > 0) {
          await this.sendInvites(space.id, invites, tx);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Log the onboarding completion (outside transaction)
    await this.userLogRepo.create({
      userId,
      action: AuditAction.ONBOARDING_COMPLETED,
    });
  }

  /**
   * Generate a 3-letter prefix for space identifiers
   */
  private generateSpacePrefix(name: string): string {
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleanName.length >= 3) {
      return cleanName.substring(0, 3);
    }
    // Fallback: use first letter + pad with X
    return cleanName.padEnd(3, 'X').substring(0, 3);
  }

  /**
   * Create initial board based on selected template
   */
  private async createTemplateBoard(
    departmentId: string,
    template: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx || this.prisma;

    const boardConfigs: Record<string, { name: string; columns: { name: string; color: string }[] }> = {
      'project-board': {
        name: 'Project Board',
        columns: [
          { name: 'Backlog', color: '#64748b' },
          { name: 'To Do', color: '#3b82f6' },
          { name: 'In Progress', color: '#f59e0b' },
          { name: 'Review', color: '#8b5cf6' },
          { name: 'Done', color: '#10b981' },
        ],
      },
      'ngo-operations': {
        name: 'NGO Operations',
        columns: [
          { name: 'New Requests', color: '#64748b' },
          { name: 'In Review', color: '#f59e0b' },
          { name: 'Approved', color: '#10b981' },
          { name: 'In Progress', color: '#3b82f6' },
          { name: 'Completed', color: '#8b5cf6' },
        ],
      },
      'budget-tracker': {
        name: 'Budget Tracker',
        columns: [
          { name: 'Budget Proposed', color: '#64748b' },
          { name: 'Under Review', color: '#f59e0b' },
          { name: 'Approved', color: '#10b981' },
          { name: 'Allocated', color: '#3b82f6' },
          { name: 'Spent', color: '#ef4444' },
        ],
      },
      'education-program': {
        name: 'Education Program',
        columns: [
          { name: 'Curriculum Planning', color: '#64748b' },
          { name: 'In Development', color: '#3b82f6' },
          { name: 'Pilot Phase', color: '#f59e0b' },
          { name: 'Active', color: '#10b981' },
          { name: 'Evaluation', color: '#8b5cf6' },
        ],
      },
      'healthcare': {
        name: 'Healthcare',
        columns: [
          { name: 'Patient Intake', color: '#64748b' },
          { name: 'Assessment', color: '#3b82f6' },
          { name: 'Treatment', color: '#f59e0b' },
          { name: 'Follow-up', color: '#10b981' },
          { name: 'Discharged', color: '#8b5cf6' },
        ],
      },
      'blank': {
        name: 'My Board',
        columns: [
          { name: 'To Do', color: '#3b82f6' },
          { name: 'In Progress', color: '#f59e0b' },
          { name: 'Done', color: '#10b981' },
        ],
      },
    };

    const config = boardConfigs[template] || boardConfigs['blank'];

    // Create the board
    const board = await prisma.board.create({
      data: {
        name: config.name,
        description: `Created from ${template} template`,
        departmentId,
        type: 'KANBAN',
        color: '#00a8e8',
      },
    });

    // Create columns
    for (let i = 0; i < config.columns.length; i++) {
      await prisma.boardColumn.create({
        data: {
          boardId: board.id,
          name: config.columns[i].name,
          position: i,
          color: config.columns[i].color,
        },
      });
    }
  }

  /**
   * Send invitations to team members
   */
  private async sendInvites(
    spaceId: string,
    invites: any[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx || this.prisma;
    const validInvites = invites.filter((invite) => invite.email && invite.email.trim());

    for (const invite of validInvites) {
      await prisma.invitation.create({
        data: {
          email: invite.email.trim().toLowerCase(),
          spaceId,
          role: invite.role || 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  private async handleFailedLogin(userId: string, ip?: string, userAgent?: string): Promise<void> {
    await this.userLogRepo.create({
      userId,
      action: AuditAction.LOGIN_FAIL,
      ipAddress: ip,
      userAgent,
    });

    // Atomic increment of failedAttempts via Prisma
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: {
          increment: 1,
        },
      },
    });

    if (updatedUser.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      // Lock the account directly via Prisma
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: new Date(Date.now() + this.LOCK_DURATION_MS),
        },
      });
    }
  }

  private async withPublicAvatarUrl<T extends { avatarUrl?: string | null } | null>(user: T): Promise<T> {
    if (!user?.avatarUrl || !user.avatarUrl.startsWith('avatars/')) {
      return user;
    }

    return {
      ...user,
      avatarUrl: await this.storage.getSignedUrl(user.avatarUrl, 3600),
    };
  }
}
