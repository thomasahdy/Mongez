import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createStorageSignature } from '../../../infrastructure/storage/storage-signature.util';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let configService: ConfigService;

  // Helper: build a mock ExecutionContext from a request object
  const buildContext = (request: Partial<any>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any);

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.jwt.accessTokenSecret') return 'super-secret-key';
        return null;
      }),
    } as any;
    guard = new JwtAuthGuard(configService);
  });

  // ─── Signed-URL bypass ───────────────────────────────────────

  describe('signed-URL bypass', () => {
    it('UT-GRD-001: should bypass JWT check for /files/key/ routes with signature query param', () => {
      const key = 'abc123';
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const signature = createStorageSignature(configService, key, expires);

      const ctx = buildContext({
        path: `/files/key/${key}/download`,
        query: { expires: String(expires), signature },
      });

      // This path bypasses super.canActivate() and returns true directly
      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should NOT bypass for /files/key/ routes WITHOUT signature param', () => {
      // super.canActivate() is called — mock it to track the delegation
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(false as any);

      const ctx = buildContext({
        path: '/files/key/abc123',
        query: {},
      });

      guard.canActivate(ctx);

      expect(superSpy).toHaveBeenCalledWith(ctx);
      superSpy.mockRestore();
    });
  });

  // ─── Standard JWT paths ──────────────────────────────────────

  describe('standard JWT validation', () => {
    it('UT-GRD-002: should delegate to passport JWT strategy for protected routes', () => {
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true as any);

      const ctx = buildContext({ path: '/api/tasks', query: {} });

      const result = guard.canActivate(ctx);

      expect(superSpy).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);
      superSpy.mockRestore();
    });

    it('UT-GRD-003: should block request when passport JWT strategy returns false', () => {
      const superSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(false as any);

      const ctx = buildContext({ path: '/api/boards', query: {} });

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
      superSpy.mockRestore();
    });
  });
});
