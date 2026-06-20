import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('auth.jwt.accessTokenSecret');
    if (!secret) {
      throw new Error('JWT access token secret is not configured');
    }
    super({
      // Try the access_token cookie first, then fall back to Authorization: Bearer header.
      // This supports both browser cookie-based auth and API clients using Bearer tokens.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false,
    });
  }

  async validate(payload: any) {
    return { 
      id: payload.sub,
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}