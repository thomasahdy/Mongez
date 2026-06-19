import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.jwt.refreshTokenSecret') {
          return 'refresh-secret-123';
        }
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  it('UT-AUTH-STRAT-003: should throw error if secret is missing in config', () => {
    configService.get.mockReturnValue(null);
    expect(() => new JwtRefreshStrategy(configService)).toThrow('JWT refresh token secret is not configured');
  });

  describe('validate()', () => {
    it('UT-AUTH-STRAT-004: should map payload sub to userId', async () => {
      const payload = { sub: 'user-1' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({ userId: 'user-1' });
    });
  });
});
