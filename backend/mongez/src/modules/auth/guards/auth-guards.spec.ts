import { CsrfGuard } from './csrf.guard';
import { RolesGuard } from './roles.guard';
import { SecurityHeadersGuard } from './security-headers.guard';
import { CsrfService } from '../services/csrf.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, BadRequestException } from '@nestjs/common';

// ─── Helper: Build a mock ExecutionContext ────────────────────

function mockContext(overrides: {
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: Record<string, string>;
  user?: any;
  sessionId?: string;
  handlerMetadata?: any;
} = {}): ExecutionContext {
  const request = {
    method: overrides.method ?? 'POST',
    headers: overrides.headers ?? {},
    cookies: overrides.cookies ?? {},
    body: overrides.body ?? {},
    user: overrides.user ?? undefined,
    sessionId: overrides.sessionId ?? 'session-abc',
  };

  const response = {
    setHeader: jest.fn(),
    removeHeader: jest.fn(),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ═══════════════════════════════════════════════════════════════
// CsrfGuard
// ═══════════════════════════════════════════════════════════════

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let csrfService: jest.Mocked<CsrfService>;

  beforeEach(() => {
    csrfService = {
      getSessionId: jest.fn().mockReturnValue('session-abc'),
      validateToken: jest.fn(),
      generateToken: jest.fn(),
    } as any;

    guard = new CsrfGuard(csrfService);
  });

  // ── Safe Methods (GET/HEAD/OPTIONS) ─────────────────────────

  it('UT-GUARD-CSRF-001: should allow GET requests without CSRF token', () => {
    const ctx = mockContext({ method: 'GET' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validateToken).not.toHaveBeenCalled();
  });

  it('UT-GUARD-CSRF-002: should allow HEAD requests without CSRF token', () => {
    const ctx = mockContext({ method: 'HEAD' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('UT-GUARD-CSRF-003: should allow OPTIONS requests without CSRF token', () => {
    const ctx = mockContext({ method: 'OPTIONS' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Bearer Token Skip ───────────────────────────────────────

  it('UT-GUARD-CSRF-004: should skip CSRF for requests with Bearer token', () => {
    const ctx = mockContext({
      method: 'POST',
      headers: { authorization: 'Bearer some-jwt-token' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validateToken).not.toHaveBeenCalled();
  });

  // ── Valid CSRF Token ────────────────────────────────────────

  it('UT-GUARD-CSRF-005: should allow POST with valid CSRF token in header', () => {
    csrfService.validateToken.mockReturnValue(true);
    const ctx = mockContext({
      method: 'POST',
      headers: { 'x-csrf-token': 'valid-csrf-token' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validateToken).toHaveBeenCalledWith(
      'session-abc',
      'valid-csrf-token',
    );
  });

  it('UT-GUARD-CSRF-006: should allow POST with valid CSRF token in cookie', () => {
    csrfService.validateToken.mockReturnValue(true);
    const ctx = mockContext({
      method: 'POST',
      cookies: { csrf_token: 'cookie-csrf-token' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(csrfService.validateToken).toHaveBeenCalledWith(
      'session-abc',
      'cookie-csrf-token',
    );
  });

  it('UT-GUARD-CSRF-007: should allow POST with valid CSRF token in body', () => {
    csrfService.validateToken.mockReturnValue(true);
    const ctx = mockContext({
      method: 'POST',
      body: { csrf_token: 'body-csrf-token' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Invalid/Missing CSRF Token ──────────────────────────────

  it('UT-GUARD-CSRF-008: should throw BadRequestException for missing CSRF token on POST', () => {
    const ctx = mockContext({ method: 'POST' });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid or expired CSRF token');
  });

  it('UT-GUARD-CSRF-009: should throw BadRequestException for invalid CSRF token', () => {
    csrfService.validateToken.mockReturnValue(false);
    const ctx = mockContext({
      method: 'POST',
      headers: { 'x-csrf-token': 'invalid-token' },
    });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it('UT-GUARD-CSRF-010: should enforce on PUT requests', () => {
    const ctx = mockContext({ method: 'PUT' });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it('UT-GUARD-CSRF-011: should enforce on DELETE requests', () => {
    const ctx = mockContext({ method: 'DELETE' });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it('UT-GUARD-CSRF-012: should enforce on PATCH requests', () => {
    const ctx = mockContext({ method: 'PATCH' });

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  // ── Token Extraction Priority ───────────────────────────────

  it('UT-GUARD-CSRF-013: should prefer header token over cookie token', () => {
    csrfService.validateToken.mockReturnValue(true);
    const ctx = mockContext({
      method: 'POST',
      headers: { 'x-csrf-token': 'header-token' },
      cookies: { csrf_token: 'cookie-token' },
    });

    guard.canActivate(ctx);

    expect(csrfService.validateToken).toHaveBeenCalledWith(
      'session-abc',
      'header-token',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// RolesGuard
// ═══════════════════════════════════════════════════════════════

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
    } as any;

    guard = new RolesGuard(reflector);
  });

  // ── No Roles Required ──────────────────────────────────────

  it('UT-GUARD-ROLES-001: should allow when no roles metadata is set', () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = mockContext({ user: { role: 'MEMBER' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Role Match ──────────────────────────────────────────────

  it('UT-GUARD-ROLES-002: should allow when user role matches required role', () => {
    reflector.get.mockReturnValue(['OWNER']);
    const ctx = mockContext({ user: { role: 'OWNER' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('UT-GUARD-ROLES-003: should allow when user role matches any of multiple required roles', () => {
    reflector.get.mockReturnValue(['OWNER', 'ADMIN']);
    const ctx = mockContext({ user: { role: 'ADMIN' } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ── Role Mismatch ──────────────────────────────────────────

  it('UT-GUARD-ROLES-004: should deny when user role does not match', () => {
    reflector.get.mockReturnValue(['OWNER']);
    const ctx = mockContext({ user: { role: 'MEMBER' } });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('UT-GUARD-ROLES-005: should deny when user has no role', () => {
    reflector.get.mockReturnValue(['OWNER']);
    const ctx = mockContext({ user: {} });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('UT-GUARD-ROLES-006: should throw when user object is missing (known defect — guard does not null-check user)', () => {
    reflector.get.mockReturnValue(['OWNER']);
    const ctx = mockContext({});

    // BUG: RolesGuard does not check for undefined user — crashes at runtime.
    // This test documents the actual behavior. Fix: add `if (!user) return false;`
    expect(() => guard.canActivate(ctx)).toThrow(TypeError);
  });
});

// ═══════════════════════════════════════════════════════════════
// SecurityHeadersGuard
// ═══════════════════════════════════════════════════════════════

describe('SecurityHeadersGuard', () => {
  let guard: SecurityHeadersGuard;

  beforeEach(() => {
    guard = new SecurityHeadersGuard({} as Reflector);
  });

  it('UT-GUARD-SEC-001: should always return true (it is a middleware-style guard)', () => {
    const ctx = mockContext({ method: 'GET' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('UT-GUARD-SEC-002: should set X-Content-Type-Options to nosniff', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    );
  });

  it('UT-GUARD-SEC-003: should set X-Frame-Options to DENY', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('UT-GUARD-SEC-004: should set X-XSS-Protection', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-XSS-Protection',
      '1; mode=block',
    );
  });

  it('UT-GUARD-SEC-005: should set Referrer-Policy', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Referrer-Policy',
      'strict-origin-when-cross-origin',
    );
  });

  it('UT-GUARD-SEC-006: should set Permissions-Policy', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('UT-GUARD-SEC-007: should remove X-Powered-By header', () => {
    const ctx = mockContext();
    const response = ctx.switchToHttp().getResponse();

    guard.canActivate(ctx);

    expect(response.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });
});
