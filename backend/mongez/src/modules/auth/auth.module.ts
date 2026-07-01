import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UserRepository } from './repositories/user.repository';
import { UserLogRepository } from './repositories/user-log.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { PasswordService } from './services/password.service';
import { JwtService } from './services/jwt.service';
import { CsrfService } from './services/csrf.service';
import { SessionService } from './services/session.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RoleSeedService } from './seed/role-seed.service';
import { CsrfGuard } from './guards/csrf.guard';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const rateLimitWindow = configService.get<number>('auth.security.rateLimitWindow') || 60000;
        const rateLimitMax = configService.get<number>('auth.security.rateLimitMax') || 10;
        return {
          throttlers: [
            {
              ttl: rateLimitWindow,
              limit: rateLimitMax,
            },
          ],
        };
      },
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => {
        const secret = configService.get<string>('auth.jwt.accessTokenSecret') || 'default-secret';
        const expiresIn = configService.get<string>('auth.jwt.accessTokenExpiresIn') || '15m';
        return {
          secret: secret,
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
    StorageModule,
    IntegrationsModule,
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    UserRepository,
    UserLogRepository,
    RefreshTokenRepository,
    PasswordService,
    JwtService,
    CsrfService,
    SessionService,
    PasswordResetService,
    EmailVerificationService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    RoleSeedService,
    CsrfGuard,
  ],
  exports: [AuthService, JwtService, PasswordService, CsrfService],
})
export class AuthModule {}
