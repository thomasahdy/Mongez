import { JwtService } from './jwt.service';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('JwtService', () => {
  let service: JwtService;
  let nestJwtService: NestJwtService;
  let configService: ConfigService;

  const ACCESS_SECRET = 'test-access-secret';
  const REFRESH_SECRET = 'test-refresh-secret';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'auth.jwt.accessTokenSecret': ACCESS_SECRET,
          'auth.jwt.refreshTokenSecret': REFRESH_SECRET,
          'auth.jwt.accessTokenExpiresIn': '15m',
          'auth.jwt.refreshTokenExpiresIn': '7d',
        };
        return config[key];
      }),
    } as any;

    nestJwtService = new NestJwtService({
      secret: ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    });

    service = new JwtService(nestJwtService, configService);
  });

  describe('generateAccessToken()', () => {
    it('UT-JWT-001: should return a valid JWT string', () => {
      const token = service.generateAccessToken('user-123', 'test@example.com');

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include sub and email in payload', () => {
      const token = service.generateAccessToken('user-123', 'test@example.com');
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should include role when provided', () => {
      const token = service.generateAccessToken('user-123', 'test@example.com', 'ADMIN');
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(decoded.role).toBe('ADMIN');
    });
  });

  describe('generateRefreshToken()', () => {
    it('UT-JWT-002: should return a valid JWT with type=refresh', () => {
      const token = service.generateRefreshToken('user-123');
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(typeof token).toBe('string');
      expect(decoded.sub).toBe('user-123');
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken()', () => {
    it('UT-JWT-003: should decode a valid access token', async () => {
      const token = service.generateAccessToken('user-123', 'test@example.com');
      const decoded = await service.verifyAccessToken(token);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('UT-JWT-004: should throw on expired token', async () => {
      // Create a service with very short expiry
      const shortConfig = {
        get: jest.fn((key: string) => {
          const config: Record<string, any> = {
            'auth.jwt.accessTokenSecret': ACCESS_SECRET,
            'auth.jwt.refreshTokenSecret': REFRESH_SECRET,
            'auth.jwt.accessTokenExpiresIn': '1s',
            'auth.jwt.refreshTokenExpiresIn': '1s',
          };
          return config[key];
        }),
      } as any;
      const shortService = new JwtService(nestJwtService, shortConfig);

      const token = shortService.generateAccessToken('user-123', 'test@example.com');

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await expect(shortService.verifyAccessToken(token)).rejects.toThrow();
    });

    it('should throw on malformed token', async () => {
      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken()', () => {
    it('UT-JWT-005: should decode a valid refresh token', async () => {
      const token = service.generateRefreshToken('user-123');
      const decoded = await service.verifyRefreshToken(token);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.type).toBe('refresh');
    });

    it('UT-JWT-006: should throw when access token is used as refresh', async () => {
      const accessToken = service.generateAccessToken('user-123', 'test@example.com');

      // Access token is signed with ACCESS_SECRET, but verifyRefreshToken uses REFRESH_SECRET
      await expect(service.verifyRefreshToken(accessToken)).rejects.toThrow();
    });
  });

  describe('getAccessTokenExpiration()', () => {
    it('UT-JWT-007: should return expiration in seconds (15m = 900s)', () => {
      const expiration = service.getAccessTokenExpiration();

      expect(expiration).toBe(900);
    });

    it('should return default 900s when config is missing', () => {
      const emptyConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      const svc = new JwtService(nestJwtService, emptyConfig);

      expect(svc.getAccessTokenExpiration()).toBe(900);
    });
  });

  describe('getRefreshTokenExpiration()', () => {
    it('UT-JWT-008: should return expiration in seconds (7d = 604800s)', () => {
      const expiration = service.getRefreshTokenExpiration();

      expect(expiration).toBe(604800);
    });

    it('should return default 604800s when config is missing', () => {
      const emptyConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      const svc = new JwtService(nestJwtService, emptyConfig);

      expect(svc.getRefreshTokenExpiration()).toBe(604800);
    });
  });

  describe('parseDurationToSeconds (private, tested via public methods)', () => {
    it('should parse seconds correctly', () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'auth.jwt.accessTokenExpiresIn') return '30s';
          if (key === 'auth.jwt.refreshTokenSecret') return REFRESH_SECRET;
          return undefined;
        }),
      } as any;
      const svc = new JwtService(nestJwtService, config);

      expect(svc.getAccessTokenExpiration()).toBe(30);
    });

    it('should parse hours correctly', () => {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'auth.jwt.accessTokenExpiresIn') return '2h';
          if (key === 'auth.jwt.refreshTokenSecret') return REFRESH_SECRET;
          return undefined;
        }),
      } as any;
      const svc = new JwtService(nestJwtService, config);

      expect(svc.getAccessTokenExpiration()).toBe(7200);
    });
  });
});