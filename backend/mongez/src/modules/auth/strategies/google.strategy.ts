import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('auth.google.clientId') || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: configService.get<string>('auth.google.clientSecret') || process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: configService.get<string>('auth.google.callbackUrl') || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const userResult = await this.authService.validateOAuthUser(profile);
      done(null, userResult);
    } catch (error) {
      done(error, false);
    }
  }
}
