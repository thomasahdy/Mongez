import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let configService: jest.Mocked<ConfigService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.google.clientId') return 'client-id';
        if (key === 'auth.google.clientSecret') return 'client-secret';
        if (key === 'auth.google.callbackUrl') return 'http://callback';
        return null;
      }),
    } as any;

    authService = {
      validateOAuthUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: ConfigService, useValue: configService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  describe('validate()', () => {
    it('UT-AUTH-STRAT-005: should call validateOAuthUser and return verified profile', async () => {
      const profile = { id: 'g-1', emails: [{ value: 'g@example.com' }] };
      const expectedUser = { id: 'user-1', email: 'g@example.com' };
      authService.validateOAuthUser.mockResolvedValue(expectedUser as any);

      const done = jest.fn();
      await strategy.validate('access-token', 'refresh-token', profile, done);

      expect(authService.validateOAuthUser).toHaveBeenCalledWith(profile);
      expect(done).toHaveBeenCalledWith(null, expectedUser);
    });

    it('UT-AUTH-STRAT-006: should call done with error if validateOAuthUser throws', async () => {
      const error = new Error('OAuth Error');
      authService.validateOAuthUser.mockRejectedValue(error);

      const done = jest.fn();
      await strategy.validate('access-token', 'refresh-token', {}, done);

      expect(done).toHaveBeenCalledWith(error, false);
    });
  });
});
