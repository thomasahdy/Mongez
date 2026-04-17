import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { JwtService } from '../../../modules/auth/services/jwt.service';
// User entity not needed for types here as we pass raw values


jest.mock('@nestjs/jwt');

describe('JwtService', () => {
  let service: JwtService;
  let jwtService: NestJwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: NestJwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'auth.jwt.accessTokenSecret': 'access-secret',
                'auth.jwt.refreshTokenSecret': 'refresh-secret',
                'auth.jwt.accessTokenExpiresIn': '15m',
                'auth.jwt.refreshTokenExpiresIn': '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    jwtService = module.get<NestJwtService>(NestJwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with user data', () => {
      const user = {
        id: 'user-id-123',
        email: 'test@example.com',
        role: 'MEMBER' as any,
      };

      const mockToken = 'mock-access-token';
      (jwtService.sign as jest.Mock).mockReturnValue(mockToken);

      const result = service.generateAccessToken(user.id, user.email, user.role);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          iat: expect.any(Number),
        },
        {
          secret: 'access-secret',
          expiresIn: '15m',
        }
      );

      expect(result).toBe(mockToken);
    });

    it('should include timestamp in payload', () => {
      const user = {
        id: 'user-id-123',
        email: 'test@example.com',
        role: 'MEMBER' as any,
      };

      service.generateAccessToken(user.id, user.email, user.role);

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(payload.iat).toBeGreaterThan(0);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with user ID', () => {
      const userId = 'user-id-123';
      const mockToken = 'mock-refresh-token';
      
      (jwtService.sign as jest.Mock).mockReturnValue(mockToken);

      const result = service.generateRefreshToken(userId);

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: userId,
          type: 'refresh',
          iat: expect.any(Number),
        },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        }
      );

      expect(result).toBe(mockToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token using correct secret', async () => {
      const token = 'access-token';
      const payload = { sub: 'user-id', email: 'test@example.com' };
      
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const result = await service.verifyAccessToken(token);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: 'access-secret',
      });

      expect(result).toBe(payload);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token using correct secret', async () => {
      const token = 'refresh-token';
      const payload = { sub: 'user-id' };
      
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

      const result = await service.verifyRefreshToken(token);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: 'refresh-secret',
      });

      expect(result).toBe(payload);
    });
  });

  describe('getAccessTokenExpiration', () => {
    it('should return correct expiration in seconds', () => {
      const expiration = service.getAccessTokenExpiration();

      expect(expiration).toBe(15 * 60); // 15 minutes in seconds
    });
  });

  describe('getRefreshTokenExpiration', () => {
    it('should return correct expiration in seconds', () => {
      const expiration = service.getRefreshTokenExpiration();

      expect(expiration).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });
  });

  describe('parseDurationToSeconds', () => {
    it('should parse seconds correctly', () => {
      const duration = service['parseDurationToSeconds']('30s');
      expect(duration).toBe(30);
    });

    it('should parse minutes correctly', () => {
      const duration = service['parseDurationToSeconds']('15m');
      expect(duration).toBe(15 * 60);
    });

    it('should parse hours correctly', () => {
      const duration = service['parseDurationToSeconds']('2h');
      expect(duration).toBe(2 * 60 * 60);
    });

    it('should parse days correctly', () => {
      const duration = service['parseDurationToSeconds']('7d');
      expect(duration).toBe(7 * 24 * 60 * 60);
    });

    it('should handle unknown units as seconds', () => {
      const duration = service['parseDurationToSeconds']('15x');
      expect(duration).toBe(15);
    });
  });
});