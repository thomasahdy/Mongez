import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.jwt.accessTokenSecret') {
          return 'secret-key-123';
        }
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAccessStrategy,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtAccessStrategy>(JwtAccessStrategy);
  });

  it('UT-AUTH-STRAT-001: should throw error if secret is missing in config', () => {
    configService.get.mockReturnValue(null);
    expect(() => new JwtAccessStrategy(configService)).toThrow('JWT access token secret is not configured');
  });

  describe('validate()', () => {
    it('UT-AUTH-STRAT-002: should map payload to validate returned details', async () => {
      const payload = { sub: 'user-1', email: 'test@example.com', role: 'MEMBER' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'MEMBER',
      });
    });
  });
});
