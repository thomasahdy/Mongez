import { CsrfService } from './csrf.service';
import { ConfigService } from '@nestjs/config';

describe('CsrfService', () => {
  let service: CsrfService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    service = new CsrfService(configService);
  });

  // ═══════════════════════════════════════════════════════════════
  // generateToken & validateToken round-trip
  // ═══════════════════════════════════════════════════════════════

  describe('generateToken()', () => {
    it('UT-CSRF-GEN-001: should generate a base64-encoded token', () => {
      const { token, expiresAt } = service.generateToken('session-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('UT-CSRF-GEN-002: should generate different tokens for different sessions', () => {
      const { token: token1 } = service.generateToken('session-1');
      const { token: token2 } = service.generateToken('session-2');

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken()', () => {
    it('UT-CSRF-VAL-001: should validate a freshly generated token', () => {
      const { token } = service.generateToken('session-1');

      expect(service.validateToken('session-1', token)).toBe(true);
    });

    it('UT-CSRF-VAL-002: should reject token for wrong session', () => {
      const { token } = service.generateToken('session-1');

      expect(service.validateToken('session-2', token)).toBe(false);
    });

    it('UT-CSRF-VAL-003: should reject empty token', () => {
      expect(service.validateToken('session-1', '')).toBe(false);
    });

    it('UT-CSRF-VAL-004: should reject null/undefined token', () => {
      expect(service.validateToken('session-1', null as any)).toBe(false);
      expect(service.validateToken('session-1', undefined as any)).toBe(false);
    });

    it('UT-CSRF-VAL-005: should reject empty session ID', () => {
      const { token } = service.generateToken('session-1');

      expect(service.validateToken('', token)).toBe(false);
    });

    it('UT-CSRF-VAL-006: should reject tampered token', () => {
      const { token } = service.generateToken('session-1');
      // Decode, corrupt the HMAC signature, re-encode
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      // Flip a character in the signature (last part)
      const sig = parts[2];
      const corruptedSig = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1);
      const tampered = Buffer.from(`${parts[0]}:${parts[1]}:${corruptedSig}`).toString('base64');

      expect(service.validateToken('session-1', tampered)).toBe(false);
    });

    it('UT-CSRF-VAL-007: should reject non-base64 garbage', () => {
      expect(service.validateToken('session-1', '!!!not-base64!!!')).toBe(
        false,
      );
    });

    it('UT-CSRF-VAL-008: should reject expired token', () => {
      jest.useFakeTimers();
      const { token } = service.generateToken('session-1');

      // Fast-forward past expiry (default 1 hour + 1ms)
      jest.advanceTimersByTime(3600001);

      expect(service.validateToken('session-1', token)).toBe(false);

      jest.useRealTimers();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getSessionId
  // ═══════════════════════════════════════════════════════════════

  describe('getSessionId()', () => {
    it('UT-CSRF-SESS-001: should return existing sessionId if present', () => {
      const request = { sessionId: 'existing-session' };

      expect(service.getSessionId(request)).toBe('existing-session');
    });

    it('UT-CSRF-SESS-002: should create and set sessionId if missing', () => {
      const request: any = {};

      const sessionId = service.getSessionId(request);

      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBe(32); // 16 bytes = 32 hex chars
      expect(request.sessionId).toBe(sessionId);
    });

    it('UT-CSRF-SESS-003: should return same ID on repeated calls', () => {
      const request: any = {};

      const first = service.getSessionId(request);
      const second = service.getSessionId(request);

      expect(first).toBe(second);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Config overrides
  // ═══════════════════════════════════════════════════════════════

  describe('config overrides', () => {
    it('UT-CSRF-CFG-001: should use custom expiry from config', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'auth.csrf.expiry') return 60000; // 1 minute
        return undefined;
      });

      const configuredService = new CsrfService(configService);
      const { expiresAt } = configuredService.generateToken('session-1');

      // Should expire within ~1 minute, not ~1 hour
      const diffMs = expiresAt.getTime() - Date.now();
      expect(diffMs).toBeLessThanOrEqual(60000);
      expect(diffMs).toBeGreaterThan(0);
    });
  });
});
