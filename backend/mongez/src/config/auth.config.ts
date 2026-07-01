import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
  const refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET;

  const defaultAccess = 'your-very-secure-access-token-secret-change-in-production';
  const defaultRefresh = 'your-very-secure-refresh-token-secret-change-in-production';

  if (isProduction) {
    if (!accessTokenSecret || accessTokenSecret === defaultAccess) {
      throw new Error('JWT_ACCESS_TOKEN_SECRET must be configured in production and cannot be the default value.');
    }
    if (!refreshTokenSecret || refreshTokenSecret === defaultRefresh) {
      throw new Error('JWT_REFRESH_TOKEN_SECRET must be configured in production and cannot be the default value.');
    }
  }

  return {
    jwt: {
      accessTokenSecret: accessTokenSecret || defaultAccess,
      refreshTokenSecret: refreshTokenSecret || defaultRefresh,
      accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
      refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
    bcrypt: {
      saltOrRounds: parseInt(process.env.BCRYPT_SALT_OR_ROUNDS || '12'),
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    security: {
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15') * 60 * 1000,
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10'),
    },
  };
});