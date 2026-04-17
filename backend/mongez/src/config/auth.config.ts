import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET || 'your-very-secure-access-token-secret-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET || 'your-very-secure-refresh-token-secret-change-in-production',
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  bcrypt: {
    saltOrRounds: parseInt(process.env.BCRYPT_SALT_OR_ROUNDS || '12'),
  },
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15') * 60 * 1000,
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '10'),
  },
}));